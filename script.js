"use strict";

/* =========================================================
   GRADEMATE — SMART ACADEMIC GPS
   Main JavaScript
   Vanilla JavaScript | No frameworks | No external APIs
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    /* =====================================================
       1. CONFIGURATION & DOM HELPERS
    ===================================================== */

    const STORAGE_KEY = "grademate-academic-data-v1";
    const THEME_KEY = "grademate-theme-v1";
    const SUBJECT_COUNT = 6;

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    const get = (id) => document.getElementById(id);

    const setText = (id, value) => {
        const element = get(id);
        if (element) element.textContent = value;
    };

    const show = (element) => {
        if (element) element.hidden = false;
    };

    const hide = (element) => {
        if (element) element.hidden = true;
    };

    const number = (value) => {
        if (value === "" || value === null || value === undefined) {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const clamp = (value, min, max) =>
        Math.min(max, Math.max(min, value));

    const round = (value, places = 2) => {
        const factor = 10 ** places;
        return Math.round((value + Number.EPSILON) * factor) / factor;
    };

    const format = (value, places = 2) =>
        Number.isFinite(value) ? value.toFixed(places) : "--";

    const escapeHTML = (value) =>
        String(value).replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);

    const safeStorage = {
        get(key) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                console.warn("Local storage is unavailable:", error);
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.warn("Could not save data:", error);
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn("Could not remove saved data:", error);
                return false;
            }
        }
    };

    const state = {
        subjects: [],
        gradingScale: [],
        config: null,
        result: null,
        simulationIndex: 0,
        simulationMarks: 30,
        studyPlanGenerated: false,
        studyAllocations: []
    };

    /* =====================================================
       2. NOTIFICATIONS & SAVE STATUS
    ===================================================== */

    function notify(message, type = "success") {
        const container = get("notificationContainer");
        if (!container) return;

        const notification = document.createElement("div");
        notification.className = `notification notification-${type}`;
        notification.setAttribute("role", "status");
        notification.textContent = message;

        container.appendChild(notification);

        window.setTimeout(() => {
            notification.classList.add("notification-hide");

            window.setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3500);
    }

    function updateSaveStatus(message, saved = true) {
        setText("saveStatusText", message);

        const status = get("saveStatus");
        if (!status) return;

        status.classList.toggle("save-status-error", !saved);
    }

    function saveCurrentForm() {
        const data = collectFormData();

        if (!data) return;

        const success = safeStorage.set(
            STORAGE_KEY,
            JSON.stringify(data)
        );

        updateSaveStatus(
            success ? "Your data is saved in this browser." :
                "Unable to save data in this browser.",
            success
        );
    }

    /* =====================================================
       3. NAVIGATION & THEME
    ===================================================== */

    const menuToggle = get("mobileMenuToggle");
    const navigation = get("primaryNavigation");

    function closeMobileMenu() {
        if (!menuToggle || !navigation) return;

        navigation.classList.remove("nav-menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation menu");
    }

    menuToggle?.addEventListener("click", () => {
        const isOpen =
            menuToggle.getAttribute("aria-expanded") === "true";

        menuToggle.setAttribute("aria-expanded", String(!isOpen));
        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Open navigation menu" : "Close navigation menu"
        );

        navigation?.classList.toggle("nav-menu-open", !isOpen);
    });

    $$(".nav-link, .nav-cta", navigation || document).forEach((link) => {
        link.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("click", (event) => {
        if (
            navigation &&
            menuToggle &&
            !navigation.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            closeMobileMenu();
        }
    });

    const themeToggle = get("themeToggle");
    const themeIcon = get("themeIcon");

    function applyTheme(theme) {
        const light = theme === "light";

        document.body.classList.toggle("light-theme", light);

        if (themeIcon) {
            themeIcon.textContent = light ? "☾" : "☀";
        }

        if (themeToggle) {
            themeToggle.setAttribute(
                "aria-label",
                light ? "Switch to dark theme" : "Switch to light theme"
            );
        }

        safeStorage.set(THEME_KEY, theme);

        if (state.result) {
            drawCharts(state.result);
        }
    }

    const savedTheme = safeStorage.get(THEME_KEY);
    applyTheme(savedTheme === "light" ? "light" : "dark");

    themeToggle?.addEventListener("click", () => {
        const isLight =
            document.body.classList.contains("light-theme");

        applyTheme(isLight ? "dark" : "light");
    });

    /* Highlight the navigation link for the visible section. */
    const navLinks = $$(".nav-link");

    if ("IntersectionObserver" in window) {
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    navLinks.forEach((link) => {
                        const active =
                            link.getAttribute("href") === `#${entry.target.id}`;

                        link.classList.toggle("active", active);
                    });
                });
            },
            {
                rootMargin: "-25% 0px -65% 0px"
            }
        );

        ["dashboard", "planner", "analytics", "study-plan"]
            .forEach((id) => {
                const section = get(id);
                if (section) sectionObserver.observe(section);
            });
    }

    /* =====================================================
       4. ACADEMIC CONFIGURATION
    ===================================================== */

    function getAssessmentConfig() {
        const cia1Max = number(get("cia1Max")?.value);
        const cia2Max = number(get("cia2Max")?.value);
        const eseMax = number(get("eseMax")?.value);

        if (
            cia1Max === null ||
            cia2Max === null ||
            eseMax === null ||
            cia1Max <= 0 ||
            cia2Max <= 0 ||
            eseMax <= 0
        ) {
            throw new Error("Enter valid maximum marks for CIA 1, CIA 2 and ESE.");
        }

        const totalMax = cia1Max + cia2Max + eseMax;

        if (totalMax > 300) {
            throw new Error("The combined maximum marks are unusually high. Please verify them.");
        }

        if (get("totalMax")) {
            get("totalMax").value = totalMax;
        }

        return {
            cia1Max,
            cia2Max,
            eseMax,
            totalMax
        };
    }

    function readGradingScale() {
        const rows = $$("#gradingTableBody tr");

        const scale = rows.map((row) => {
            const inputs = $$("input", row);

            return {
                label: row.cells[0]?.textContent.trim() || "Grade",
                min: number(inputs[0]?.value),
                max: number(inputs[1]?.value),
                point: number(inputs[2]?.value)
            };
        });

        if (scale.length === 0) {
            throw new Error("No grading boundaries were found.");
        }

        for (const grade of scale) {
            if (
                grade.min === null ||
                grade.max === null ||
                grade.point === null ||
                grade.min < 0 ||
                grade.max > 100 ||
                grade.min > grade.max ||
                grade.point < 0 ||
                grade.point > 10
            ) {
                throw new Error(
                    "Check your grading table. Marks must be between 0 and 100 and grade points between 0 and 10."
                );
            }
        }

        const sorted = [...scale].sort((a, b) => a.min - b.min);

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].min <= sorted[i - 1].max) {
                throw new Error(
                    "Your grading ranges overlap. Correct the minimum and maximum marks."
                );
            }
        }

        return scale.sort((a, b) => b.min - a.min);
    }

    function findGrade(totalMarks, scale) {
        const percentage = (totalMarks / 100);

        return scale.find((grade) =>
            percentage * 100 >= grade.min - 0.0001 &&
            percentage * 100 <= grade.max + 0.0001
        ) || null;
    }

    function gradeForTotal(totalMarks, totalMax, scale) {
        const percentage = (totalMarks / totalMax) * 100;
        const grade = findGrade(percentage, scale);

        return {
            percentage,
            grade,
            point: grade ? grade.point : 0,
            label: grade ? grade.label : "Unclassified"
        };
    }

    /* =====================================================
       5. READ & VALIDATE STUDENT INPUT
    ===================================================== */

    function readSubjects(config) {
        const subjects = [];

        for (let index = 0; index < SUBJECT_COUNT; index++) {
            const name = get(`subjectName${index}`)?.value.trim();
            const credits = number(get(`credits${index}`)?.value);
            const cia1 = number(get(`cia1_${index}`)?.value);
            const cia2 = number(get(`cia2_${index}`)?.value);
            const ese = number(get(`ese_${index}`)?.value);

            if (!name) {
                throw new Error(`Enter a name for Subject ${index + 1}.`);
            }

            if (
                credits === null ||
                credits <= 0 ||
                credits > 30
            ) {
                throw new Error(`Enter valid credits for ${name}.`);
            }

            if (
                cia1 === null ||
                cia1 < 0 ||
                cia1 > config.cia1Max
            ) {
                throw new Error(
                    `CIA 1 marks for ${name} must be between 0 and ${config.cia1Max}.`
                );
            }

            if (
                cia2 === null ||
                cia2 < 0 ||
                cia2 > config.cia2Max
            ) {
                throw new Error(
                    `CIA 2 marks for ${name} must be between 0 and ${config.cia2Max}.`
                );
            }

            if (
                ese !== null &&
                (ese < 0 || ese > config.eseMax)
            ) {
                throw new Error(
                    `ESE marks for ${name} must be between 0 and ${config.eseMax}.`
                );
            }

            subjects.push({
                index,
                name,
                credits,
                cia1,
                cia2,
                ese,
                ciaTotal: cia1 + cia2
            });
        }

        const totalCredits = subjects.reduce(
            (sum, subject) => sum + subject.credits,
            0
        );

        if (totalCredits <= 0) {
            throw new Error("Total credits must be greater than zero.");
        }

        return subjects;
    }

    function validatePreviousResults() {
        const previousCgpa = number(get("previousCgpa")?.value);
        const previousCredits = number(get("previousCredits")?.value);

        if (
            (previousCgpa !== null && previousCredits === null) ||
            (previousCgpa === null && previousCredits !== null)
        ) {
            throw new Error(
                "Enter both previous CGPA and previous completed credits, or leave both blank."
            );
        }

        if (
            previousCgpa !== null &&
            (previousCgpa < 0 || previousCgpa > 10)
        ) {
            throw new Error("Previous CGPA must be between 0 and 10.");
        }

        if (
            previousCredits !== null &&
            previousCredits <= 0
        ) {
            throw new Error("Previously completed credits must be greater than zero.");
        }

        return { previousCgpa, previousCredits };
    }

    /* =====================================================
       6. SGPA CALCULATION ENGINE
    ===================================================== */

    function calculateSgpa(subjects, scale, config, eseOverrides = {}) {
        let weightedPoints = 0;
        let totalCredits = 0;

        const calculatedSubjects = subjects.map((subject) => {
            const hasOverride =
                Object.prototype.hasOwnProperty.call(
                    eseOverrides,
                    subject.index
                );

            const ese = hasOverride
                ? eseOverrides[subject.index]
                : subject.ese;

            const finalMarks =
                subject.ciaTotal + (ese ?? 0);

            const gradeInfo = gradeForTotal(
                finalMarks,
                config.totalMax,
                scale
            );

            weightedPoints +=
                gradeInfo.point * subject.credits;

            totalCredits += subject.credits;

            return {
                ...subject,
                projectedEse: ese,
                finalMarks,
                ...gradeInfo
            };
        });

        return {
            sgpa: totalCredits > 0
                ? weightedPoints / totalCredits
                : 0,
            totalCredits,
            subjects: calculatedSubjects
        };
    }

    function getEstimatedEse(subject, config, scenario = "expected") {
        if (subject.ese !== null) {
            return subject.ese;
        }

        const ciaPercentage =
            subject.ciaTotal /
            (config.cia1Max + config.cia2Max);

        const expected = ciaPercentage * config.eseMax;

        let estimate = expected;

        if (scenario === "conservative") {
            estimate = expected - config.eseMax * 0.10;
        } else if (scenario === "optimistic") {
            estimate = expected + config.eseMax * 0.10;
        }

        return round(clamp(estimate, 0, config.eseMax));
    }

    function buildScenarioResults(subjects, scale, config) {
        const scenarios = {};

        ["conservative", "expected", "optimistic"].forEach((scenario) => {
            const overrides = {};

            subjects.forEach((subject) => {
                overrides[subject.index] = getEstimatedEse(
                    subject,
                    config,
                    scenario
                );
            });

            scenarios[scenario] = calculateSgpa(
                subjects,
                scale,
                config,
                overrides
            );
        });

        return scenarios;
    }

    /* =====================================================
       7. TARGET PLANNING ENGINE
       Finds practical subject-wise ESE targets.
    ===================================================== */

    function getGradeOptions(subject, scale, config) {
        const options = [];

        scale.forEach((grade) => {
            const requiredTotal =
                (grade.min / 100) * config.totalMax;

            const requiredEse = Math.ceil(
                requiredTotal - subject.ciaTotal - 0.00001
            );

            if (
                requiredEse >= 0 &&
                requiredEse <= config.eseMax
            ) {
                options.push({
                    grade: grade.label,
                    point: grade.point,
                    minEse: requiredEse,
                    minTotal: requiredTotal
                });
            }
        });

        return options.sort((a, b) =>
            a.point - b.point || a.minEse - b.minEse
        );
    }

    function createTargetPlan(
        subjects,
        scale,
        config,
        targetSgpa,
        expectedResult
    ) {
        const planned = expectedResult.subjects.map((subject) => {
            const options = getGradeOptions(
                subject,
                scale,
                config
            );

            const currentGrade = gradeForTotal(
                subject.finalMarks,
                config.totalMax,
                scale
            );

            const currentEse = subject.projectedEse ?? 0;

            return {
                ...subject,
                currentEse,
                currentPoint: currentGrade.point,
                targetEse: currentEse,
                targetPoint: currentGrade.point,
                targetGrade: currentGrade.label,
                options,
                selectedOptionIndex: -1
            };
        });

        const credits = planned.reduce(
            (sum, subject) => sum + subject.credits,
            0
        );

        const weighted = () =>
            planned.reduce(
                (sum, subject) =>
                    sum + subject.targetPoint * subject.credits,
                0
            );

        const requiredWeightedPoints = targetSgpa * credits;

        const steps = [];

        planned.forEach((subject, subjectPosition) => {
            const higherOptions = subject.options.filter(
                (option) => option.point > subject.targetPoint
            );

            higherOptions.forEach((option) => {
                const gain =
                    (option.point - subject.targetPoint) *
                    subject.credits;

                const extraMarks = Math.max(
                    0,
                    option.minEse - subject.currentEse
                );

                steps.push({
                    subjectPosition,
                    option,
                    gain,
                    extraMarks,
                    efficiency: extraMarks / Math.max(gain, 0.001)
                });
            });
        });

        /*
           Greedy improvement strategy:
           Prefer grade-point improvements that require fewer
           additional ESE marks for each weighted point gained.
        */

        steps.sort((a, b) =>
            a.efficiency - b.efficiency ||
            b.gain - a.gain
        );

        let currentWeighted = weighted();

        for (const step of steps) {
            if (currentWeighted >= requiredWeightedPoints) break;

            const subject = planned[step.subjectPosition];

            if (step.option.point <= subject.targetPoint) continue;

            subject.targetPoint = step.option.point;
            subject.targetGrade = step.option.grade;
            subject.targetEse = Math.max(
                subject.currentEse,
                step.option.minEse
            );

            subject.selectedOptionIndex =
                subject.options.indexOf(step.option);

            currentWeighted = weighted();
        }

        const achievedTarget = currentWeighted >=
            requiredWeightedPoints - 0.0001;

        planned.forEach((subject) => {
            subject.targetEse = clamp(
                Math.ceil(subject.targetEse),
                0,
                config.eseMax
            );

            subject.expectedTotal =
                subject.ciaTotal + subject.targetEse;

            subject.actualOrProjectedGrade = gradeForTotal(
                subject.expectedTotal,
                config.totalMax,
                scale
            );

            subject.gap = Math.max(
                0,
                subject.targetEse - subject.currentEse
            );

            subject.priority = getPriority(subject);
        });

        const targetSgpaFromPlan =
            weighted() / Math.max(credits, 1);

        return {
            subjects: planned,
            achievedTarget,
            targetSgpaFromPlan,
            targetSgpa,
            maximumPossibleSgpa: calculateMaximumSgpa(
                subjects,
                scale,
                config
            )
        };
    }

    function calculateMaximumSgpa(subjects, scale, config) {
        const maximumOverrides = {};

        subjects.forEach((subject) => {
            maximumOverrides[subject.index] = config.eseMax;
        });

        return calculateSgpa(
            subjects,
            scale,
            config,
            maximumOverrides
        ).sgpa;
    }

    /* =====================================================
       8. PRIORITY ANALYZER
    ===================================================== */

    function getPriority(subject) {
        const performance = subject.percentage ?? 0;
        const creditWeight = subject.credits ?? 0;

        let score = 0;

        if (performance < 50) score += 4;
        else if (performance < 65) score += 3;
        else if (performance < 75) score += 2;
        else if (performance < 85) score += 1;

        if (creditWeight >= 4) score += 2;
        else if (creditWeight >= 3) score += 1;

        if (subject.gap > 10) score += 2;
        else if (subject.gap > 5) score += 1;

        if (score >= 6) return "High";
        if (score >= 3) return "Medium";
        return "Maintain";
    }

    function getPriorityClass(priority) {
        if (priority === "High") return "high-priority";
        if (priority === "Medium") return "medium-priority";
        return "maintain-priority";
    }

    function getWeeklyHours(subject, totalHours, allSubjects) {
        const weight = (subject.priority === "High" ? 3 :
            subject.priority === "Medium" ? 2 : 1) *
            Math.max(subject.credits, 0.5);

        const totalWeight = allSubjects.reduce(
            (sum, item) =>
                sum +
                (item.priority === "High" ? 3 :
                    item.priority === "Medium" ? 2 : 1) *
                Math.max(item.credits, 0.5),
            0
        );

        return totalWeight > 0
            ? (weight / totalWeight) * totalHours
            : totalHours / allSubjects.length;
    }

    /* =====================================================
       9. COLLECT FORM DATA
    ===================================================== */

    function collectFormData() {
        try {
            const config = getAssessmentConfig();
            const subjects = readSubjects(config);
            const previous = validatePreviousResults();

            const targetSgpa = number(get("targetSgpa")?.value);

            if (
                targetSgpa === null ||
                targetSgpa < 0 ||
                targetSgpa > 10
            ) {
                throw new Error("Your target SGPA must be between 0 and 10.");
            }

            const gradingScale = readGradingScale();

            return {
                config,
                subjects,
                previous,
                targetSgpa,
                gradingScale,
                semester: get("semesterSelect")?.value || "1",
                university: get("universityName")?.value || "custom"
            };
        } catch (error) {
            return null;
        }
    }

    /* =====================================================
       10. COMPLETE CALCULATION
    ===================================================== */

    function calculateAcademicResult(data) {
        const {
            config,
            subjects,
            previous,
            targetSgpa,
            gradingScale
        } = data;

        const scenarios = buildScenarioResults(
            subjects,
            gradingScale,
            config
        );

        const expected = scenarios.expected;

        const targetPlan = createTargetPlan(
            subjects,
            gradingScale,
            config,
            targetSgpa,
            expected
        );

        const cumulativeCgpa =
            previous.previousCgpa !== null &&
            previous.previousCredits !== null
                ? (
                    previous.previousCgpa *
                    previous.previousCredits +
                    expected.sgpa *
                    expected.totalCredits
                ) /
                (previous.previousCredits + expected.totalCredits)
                : null;

        return {
            config,
            subjects,
            previous,
            targetSgpa,
            gradingScale,
            semester: data.semester,
            university: data.university,
            scenarios,
            expected,
            targetPlan,
            cumulativeCgpa,
            totalCredits: expected.totalCredits,
            actualEseCount: subjects.filter(
                (subject) => subject.ese !== null
            ).length,
            pendingEseCount: subjects.filter(
                (subject) => subject.ese === null
            ).length
        };
    }

    /* =====================================================
       11. FORM FEEDBACK
    ===================================================== */

    function showFormError(message) {
        const feedback = get("formFeedback");
        if (!feedback) return;

        feedback.textContent = message;
        feedback.classList.add("feedback-error");
        feedback.classList.remove("feedback-success");
        show(feedback);

        feedback.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function showFormSuccess(message) {
        const feedback = get("formFeedback");
        if (!feedback) return;

        feedback.textContent = message;
        feedback.classList.remove("feedback-error");
        feedback.classList.add("feedback-success");
        show(feedback);
    }

    /* =====================================================
       12. DASHBOARD RENDERING
    ===================================================== */

    function renderDashboard(result) {
        setText("currentSgpa", format(result.expected.sgpa));
        setText("dashboardTarget", format(result.targetSgpa));
        setText("totalCredits", format(result.totalCredits, 1));

        const prioritySubjects =
            result.targetPlan.subjects.filter(
                (subject) => subject.priority === "High"
            );

        setText("priorityCount", String(prioritySubjects.length));

        setText(
            "currentSgpaNote",
            result.pendingEseCount > 0
                ? "Projected using pending ESE estimates"
                : "Calculated from entered examination marks"
        );

        setText(
            "semesterBadge",
            `Semester ${result.semester}`
        );

        hide(get("dashboardEmptyState"));
    }

    /* =====================================================
       13. ROADMAP RENDERING
    ===================================================== */

    function renderRoadmap(result) {
        const roadmap = get("roadmap");
        if (!roadmap) return;

        show(roadmap);

        setText("resultTargetSgpa", format(result.targetSgpa));
        setText("resultExpectedSgpa", format(result.expected.sgpa));

        const feasible = result.targetPlan.achievedTarget;

        setText(
            "resultFeasibility",
            feasible ? "Achievable" : "Challenging"
        );

        setText(
            "resultFeasibilityDescription",
            feasible
                ? "The configured grade scale allows this target."
                : "The target exceeds the current practical plan."
        );

        setText(
            "resultCumulativeCgpa",
            result.cumulativeCgpa === null
                ? "--"
                : format(result.cumulativeCgpa)
        );

        setText(
            "cumulativeCgpaNote",
            result.cumulativeCgpa === null
                ? "Enter previous CGPA and credits to calculate."
                : "Estimated cumulative CGPA"
        );

        const status = get("resultStatus");

        if (status) {
            status.textContent =
                result.pendingEseCount > 0
                    ? `${result.pendingEseCount} ESE result(s) are pending. The projected SGPA uses estimates for those subjects.`
                    : "All ESE marks have been entered. The SGPA is calculated from your supplied marks.";

            status.classList.toggle(
                "status-warning",
                result.pendingEseCount > 0
            );
        }

        const insight = get("personalizedInsight");

        if (insight) {
            const highestPriority =
                [...result.targetPlan.subjects].sort(
                    (a, b) => b.gap - a.gap
                )[0];

            insight.textContent =
                highestPriority && highestPriority.gap > 0
                    ? `${highestPriority.name} has the largest suggested ESE improvement gap. Focus on the topics where you lose marks, practise timed questions, and review your CIA mistakes.`
                    : "Your projected marks already align closely with the suggested subject targets. Focus on consistent revision and protecting your stronger subjects.";
        }

        const alert = get("feasibilityAlert");

        if (alert) {
            if (!feasible) {
                alert.textContent =
                    `Your requested SGPA of ${format(result.targetSgpa)} is above the SGPA achievable through the configured grade scale and marks. The maximum possible SGPA with full ESE marks is approximately ${format(result.targetPlan.maximumPossibleSgpa)}. Consider a lower target.`;
                show(alert);
            } else {
                alert.textContent =
                    "Your target is achievable under the currently configured grading scale. The suggested ESE marks are planning estimates, not guarantees.";
                show(alert);
            }
        }

        renderTargetTable(result);
        renderMarksGap(result);
    }

    function renderTargetTable(result) {
        const tbody = get("subjectTargetTableBody");
        if (!tbody) return;

        tbody.replaceChildren();

        result.targetPlan.subjects.forEach((subject) => {
            const row = document.createElement("tr");

            const values = [
                subject.name,
                format(subject.credits, 1),
                `${format(subject.ciaTotal, 1)} / ${format(
                    result.config.cia1Max + result.config.cia2Max,
                    1
                )}`,
                `${format(subject.targetEse, 0)} / ${format(
                    result.config.eseMax,
                    0
                )}`,
                `${format(subject.expectedTotal, 1)} / ${format(
                    result.config.totalMax,
                    1
                )}`,
                format(subject.targetPoint, 1),
                subject.priority
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value;

                if (index === 6) {
                    const badge = document.createElement("span");
                    badge.className =
                        `priority-label ${getPriorityClass(subject.priority)}`;
                    badge.textContent = subject.priority;

                    cell.replaceChildren(badge);
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
    }

    function renderMarksGap(result) {
        const container = get("marksGapList");
        if (!container) return;

        container.replaceChildren();

        result.targetPlan.subjects.forEach((subject) => {
            const item = document.createElement("div");
            item.className = "marks-gap-item";

            const heading = document.createElement("div");
            heading.className = "marks-gap-heading";

            const name = document.createElement("strong");
            name.textContent = subject.name;

            const gap = document.createElement("span");
            gap.textContent = subject.gap > 0
                ? `${format(subject.gap, 0)} additional ESE marks suggested`
                : "No additional ESE marks suggested";

            heading.append(name, gap);

            const track = document.createElement("div");
            track.className = "progress-track";

            const fill = document.createElement("div");
            fill.className = "progress-fill";

            const progress =
                subject.targetEse / result.config.eseMax * 100;

            fill.style.width = `${clamp(progress, 0, 100)}%`;

            track.appendChild(fill);
            item.append(heading, track);

            container.appendChild(item);
        });
    }

    /* =====================================================
       14. ANALYTICS & PERFORMANCE SCENARIOS
    ===================================================== */

    function renderAnalytics(result) {
        show(get("analyticsContent"));
        hide(get("analyticsEmptyState"));

        setText(
            "conservativeSgpa",
            format(result.scenarios.conservative.sgpa)
        );

        setText(
            "predictedSgpa",
            format(result.scenarios.expected.sgpa)
        );

        setText(
            "optimisticSgpa",
            format(result.scenarios.optimistic.sgpa)
        );

        drawCharts(result);
    }

    function drawCharts(result) {
        drawBarChart(
            get("predictionChart"),
            [
                {
                    label: "Conservative",
                    value: result.scenarios.conservative.sgpa
                },
                {
                    label: "Expected",
                    value: result.scenarios.expected.sgpa
                },
                {
                    label: "Optimistic",
                    value: result.scenarios.optimistic.sgpa
                }
            ],
            10
        );

        drawBarChart(
            get("subjectPerformanceChart"),
            result.expected.subjects.map((subject) => ({
                label: subject.name,
                value: subject.percentage
            })),
            100
        );
    }

    function drawBarChart(canvas, data, maximum) {
        if (!canvas || !canvas.getContext) return;

        const rect = canvas.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const pixelRatio = Math.max(
            1,
            Math.min(window.devicePixelRatio || 1, 2)
        );

        canvas.width = rect.width * pixelRatio;
        canvas.height = rect.height * pixelRatio;

        context.setTransform(
            pixelRatio,
            0,
            0,
            pixelRatio,
            0,
            0
        );

        const width = rect.width;
        const height = rect.height;

        context.clearRect(0, 0, width, height);

        const light =
            document.body.classList.contains("light-theme");

        const textColor = light ? "#536079" : "#A8B1C5";
        const gridColor = light ? "#DCE2EF" : "#28334B";
        const barColors = ["#64A7FF", "#8B80FF", "#35C995"];

        const left = 42;
        const right = 12;
        const top = 15;
        const bottom = 48;

        const chartWidth = width - left - right;
        const chartHeight = height - top - bottom;

        if (chartWidth <= 0 || chartHeight <= 0) return;

        context.font = "11px Arial";
        context.textBaseline = "middle";

        for (let line = 0; line <= 4; line++) {
            const y = top + chartHeight * (line / 4);

            context.beginPath();
            context.strokeStyle = gridColor;
            context.lineWidth = 1;
            context.moveTo(left, y);
            context.lineTo(width - right, y);
            context.stroke();

            const value = maximum * (1 - line / 4);

            context.fillStyle = textColor;
            context.textAlign = "right";
            context.fillText(
                maximum === 10
                    ? value.toFixed(1)
                    : `${Math.round(value)}%`,
                left - 8,
                y
            );
        }

        const slotWidth = chartWidth / Math.max(data.length, 1);
        const barWidth = Math.min(
            42,
            slotWidth * 0.55
        );

        data.forEach((item, index) => {
            const x =
                left +
                slotWidth * index +
                (slotWidth - barWidth) / 2;

            const value = clamp(item.value || 0, 0, maximum);
            const barHeight = chartHeight * value / maximum;
            const y = top + chartHeight - barHeight;

            context.fillStyle = barColors[index % barColors.length];

            context.beginPath();

            if (typeof context.roundRect === "function") {
                context.roundRect(
                    x,
                    y,
                    barWidth,
                    Math.max(barHeight, 2),
                    6
                );
            } else {
                context.rect(
                    x,
                    y,
                    barWidth,
                    Math.max(barHeight, 2)
                );
            }

            context.fill();

            context.fillStyle = textColor;
            context.textAlign = "center";
            context.font = "11px Arial";

            const displayValue =
                maximum === 10
                    ? value.toFixed(2)
                    : `${Math.round(value)}%`;

            context.fillText(
                displayValue,
                x + barWidth / 2,
                Math.max(top + 8, y - 10)
            );

            const label = item.label.length > 13
                ? `${item.label.slice(0, 11)}…`
                : item.label;

            context.fillText(
                label,
                x + barWidth / 2,
                height - 20
            );
        });
    }

    /* =====================================================
       15. SUBJECT PRIORITY ANALYZER
    ===================================================== */

    function renderPriorities(result) {
        show(get("priorityContent"));
        hide(get("priorityEmptyState"));

        const subjects = [...result.targetPlan.subjects]
            .sort((a, b) => {
                const priorityOrder = {
                    High: 3,
                    Medium: 2,
                    Maintain: 1
                };

                return (
                    priorityOrder[b.priority] -
                    priorityOrder[a.priority]
                ) || b.credits - a.credits;
            });

        const highCount = subjects.filter(
            (subject) => subject.priority === "High"
        ).length;

        setText(
            "prioritySummaryText",
            highCount > 0
                ? `${highCount} subject(s) need focused attention. Start with the highest-priority subject, then maintain regular revision in the others.`
                : "Your current subject profile is reasonably balanced. Maintain consistency and revise all subjects regularly."
        );

        const cards = get("priorityCards");
        if (!cards) return;

        cards.replaceChildren();

        subjects.forEach((subject) => {
            const card = document.createElement("article");
            card.className = "priority-card";

            const header = document.createElement("div");
            header.className = "priority-card-header";

            const title = document.createElement("h3");
            title.textContent = subject.name;

            const badge = document.createElement("span");
            badge.className =
                `priority-label ${getPriorityClass(subject.priority)}`;
            badge.textContent = `${subject.priority} priority`;

            header.append(title, badge);

            const details = document.createElement("div");
            details.className = "priority-card-details";

            const percentage = document.createElement("span");
            percentage.textContent =
                `Projected performance: ${format(subject.percentage, 1)}%`;

            const credits = document.createElement("span");
            credits.textContent =
                `Credits: ${format(subject.credits, 1)}`;

            const grade = document.createElement("span");
            grade.textContent =
                `Projected grade point: ${format(subject.point, 1)}`;

            details.append(percentage, credits, grade);

            const recommendation = document.createElement("p");
            recommendation.textContent =
                subject.priority === "High"
                    ? "Give this subject extra practice time. Review difficult concepts and solve questions under timed conditions."
                    : subject.priority === "Medium"
                        ? "Schedule regular revision and practise the topics where you lose marks."
                        : "Maintain your current preparation and avoid neglecting revision.";

            card.append(header, details, recommendation);
            cards.appendChild(card);
        });

        renderRecommendations(subjects);
    }

    function renderRecommendations(subjects) {
        const list = get("recommendationList");
        if (!list) return;

        list.replaceChildren();

        const recommendations = subjects.slice(0, 3).map((subject) => {
            if (subject.priority === "High") {
                return `Prioritise ${subject.name}: review your weakest topics and complete a timed practice set.`;
            }

            if (subject.priority === "Medium") {
                return `Strengthen ${subject.name} through regular revision and targeted question practice.`;
            }

            return `Maintain ${subject.name} with short revision sessions so your performance stays consistent.`;
        });

        recommendations.forEach((recommendation) => {
            const item = document.createElement("li");
            item.textContent = recommendation;
            list.appendChild(item);
        });
    }

    /* =====================================================
       16. WHAT-IF SIMULATOR
    ===================================================== */

    function activateSimulator(result) {
        show(get("simulatorContent"));
        hide(get("simulatorEmptyState"));

        const select = get("simulatorSubject");
        if (!select) return;

        select.replaceChildren();

        result.subjects.forEach((subject, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = subject.name;
            select.appendChild(option);
        });

        state.simulationIndex = 0;

        const firstSubject = result.subjects[0];
        const initialMarks =
            firstSubject.ese ??
            getEstimatedEse(firstSubject, result.config, "expected");

        state.simulationMarks = initialMarks;

        const slider = get("eseSimulatorSlider");

        if (slider) {
            slider.max = String(result.config.eseMax);
            slider.value = String(initialMarks);
        }

        updateSimulator();
    }

    function updateSimulator() {
        if (!state.result) return;

        const result = state.result;
        const select = get("simulatorSubject");
        const slider = get("eseSimulatorSlider");

        if (!select || !slider) return;

        const index = Number(select.value);

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= result.subjects.length
        ) {
            return;
        }

        state.simulationIndex = index;

        const subject = result.subjects[index];
        const marks = clamp(
            Number(slider.value),
            0,
            result.config.eseMax
        );

        state.simulationMarks = marks;

        setText(
            "simulatorMarksValue",
            `${format(marks, 0)} / ${format(result.config.eseMax, 0)}`
        );

        const simulationOverrides = {};

result.subjects.forEach((item) => {
    simulationOverrides[item.index] =
        item.index === subject.index
            ? marks
            : getEstimatedEse(item, result.config, "expected");
});

const simulated = calculateSgpa(
    result.subjects,
    result.gradingScale,
    result.config,
    simulationOverrides
);

        const original = result.expected.sgpa;
        const updated = simulated.sgpa;
        const difference = updated - original;

        setText("originalSimulationSgpa", format(original));
        setText("updatedSimulationSgpa", format(updated));

        setText(
            "simulationDifference",
            `${difference >= 0 ? "+" : ""}${format(difference)}`
        );

        const simulatedSubject = simulated.subjects[index];
        const targetMet = updated >= result.targetSgpa;

        setText(
            "simulationFeedback",
            `${subject.name}: ${format(marks, 0)} ESE marks gives an estimated grade point of ${format(simulatedSubject.point, 1)}. Your projected SGPA is ${format(updated)}. ${targetMet ? "Your target SGPA is reached in this scenario." : `You are ${format(result.targetSgpa - updated)} SGPA points below your target.`}`
        );
    }

    function resetSimulation() {
        if (!state.result) return;

        const subject = state.result.subjects[state.simulationIndex];

        const marks = subject.ese ??
            getEstimatedEse(subject, state.result.config, "expected");

        const slider = get("eseSimulatorSlider");

        if (slider) slider.value = String(marks);

        updateSimulator();
    }

    /* =====================================================
       17. STUDY PLAN GENERATOR
    ===================================================== */

    function generateStudyAllocations(result, totalHours) {
        const subjects = [...result.targetPlan.subjects];

        const allocations = subjects.map((subject) => ({
            ...subject,
            hours: getWeeklyHours(
                subject,
                totalHours,
                subjects
            )
        }));

        /*
           Correct rounding differences so the displayed
           allocation adds up to the requested total.
        */

        const rounded = allocations.map((subject) => ({
            ...subject,
            hours: Math.round(subject.hours * 10) / 10
        }));

        const roundedTotal = rounded.reduce(
            (sum, subject) => sum + subject.hours,
            0
        );

        if (rounded.length > 0) {
            rounded[0].hours = round(
                rounded[0].hours + totalHours - roundedTotal,
                1
            );
        }

        return rounded.sort((a, b) => b.hours - a.hours);
    }

    function renderStudyPlan(result, forceNotify = false) {
        const hoursInput = get("weeklyStudyHours");
        const totalHours = number(hoursInput?.value);

        if (
            totalHours === null ||
            totalHours < 1 ||
            totalHours > 100
        ) {
            notify("Enter weekly study hours between 1 and 100.", "error");
            return;
        }

        const allocations = generateStudyAllocations(
            result,
            totalHours
        );

        state.studyAllocations = allocations;
        state.studyPlanGenerated = true;

        show(get("studyContent"));
        hide(get("studyEmptyState"));

        setText(
            "totalStudyHours",
            `${format(totalHours, 1)} hours`
        );

        const list = get("studyAllocationList");
        if (!list) return;

        list.replaceChildren();

        allocations.forEach((subject) => {
            const row = document.createElement("div");
            row.className = "study-allocation-item";

            const heading = document.createElement("div");
            heading.className = "study-allocation-heading";

            const name = document.createElement("strong");
            name.textContent = subject.name;

            const time = document.createElement("span");
            time.textContent = `${format(subject.hours, 1)} hours`;

            heading.append(name, time);

            const track = document.createElement("div");
            track.className = "progress-track";

            const fill = document.createElement("div");
            fill.className = "progress-fill";

            fill.style.width =
                `${clamp(subject.hours / totalHours * 100, 0, 100)}%`;

            track.appendChild(fill);
            row.append(heading, track);

            list.appendChild(row);
        });

        updateAchievementStatuses();

        if (forceNotify) {
            notify("Your weekly study schedule has been generated.");
        }
    }

    /* =====================================================
       18. ACHIEVEMENTS
    ===================================================== */

    function unlockAchievement(cardId, statusId, unlocked) {
        const card = get(cardId);
        const status = get(statusId);

        if (!card || !status) return;

        card.classList.toggle("achievement-unlocked", unlocked);
        status.textContent = unlocked ? "Unlocked ✓" : "Locked";
    }

    function updateAchievementStatuses() {
        const hasRoadmap = Boolean(state.result);
        const hasTarget = Boolean(
            state.result &&
            state.result.targetSgpa > 0
        );

        unlockAchievement(
            "achievementFirstRoadmap",
            "firstRoadmapStatus",
            hasRoadmap
        );

        unlockAchievement(
            "achievementTarget",
            "targetAchievementStatus",
            hasTarget
        );

        unlockAchievement(
            "achievementStudy",
            "studyAchievementStatus",
            state.studyPlanGenerated
        );
    }

    /* =====================================================
       19. REPORT DOWNLOAD
    ===================================================== */

    function downloadAcademicReport() {
        if (!state.result) {
            notify("Generate your academic roadmap first.", "error");
            return;
        }

        const result = state.result;

        const lines = [
            "GRADEMATE — ACADEMIC REPORT",
            "========================================",
            `Generated: ${new Date().toLocaleString()}`,
            `Semester: ${result.semester}`,
            `Target SGPA: ${format(result.targetSgpa)}`,
            `Expected SGPA: ${format(result.expected.sgpa)}`,
            `Conservative SGPA: ${format(result.scenarios.conservative.sgpa)}`,
            `Optimistic SGPA: ${format(result.scenarios.optimistic.sgpa)}`,
            `Total credits: ${format(result.totalCredits, 1)}`,
            "",
            "SUBJECT-WISE TARGETS",
            "----------------------------------------"
        ];

        result.targetPlan.subjects.forEach((subject) => {
            lines.push(
                `${subject.name} | Credits: ${subject.credits} | CIA: ${subject.ciaTotal} | Suggested ESE: ${subject.targetEse}/${result.config.eseMax} | Expected total: ${subject.expectedTotal}/${result.config.totalMax} | Grade point: ${subject.targetPoint} | Priority: ${subject.priority}`
            );
        });

        lines.push(
            "",
            "IMPORTANT",
            "These are estimates based on the grading boundaries entered by the user. They are not official university results or guaranteed examination outcomes.",
            "Verify official grade boundaries and passing requirements with your university."
        );

        const blob = new Blob(
            [lines.join("\n")],
            { type: "text/plain;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "GRADEMATE-Academic-Report.txt";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        notify("Your academic report has been downloaded.");
    }

    /* =====================================================
       20. MAIN ROADMAP SUBMISSION
    ===================================================== */

    function generateRoadmap(event) {
        event?.preventDefault();

        try {
            const config = getAssessmentConfig();
            const subjects = readSubjects(config);
            const previous = validatePreviousResults();
            const gradingScale = readGradingScale();

            const targetSgpa = number(get("targetSgpa")?.value);

            if (
                targetSgpa === null ||
                targetSgpa < 0 ||
                targetSgpa > 10
            ) {
                throw new Error("Your target SGPA must be between 0 and 10.");
            }

            const data = {
                config,
                subjects,
                previous,
                targetSgpa,
                gradingScale,
                semester: get("semesterSelect")?.value || "1",
                university: get("universityName")?.value || "custom"
            };

            const result = calculateAcademicResult(data);

            state.subjects = subjects;
            state.gradingScale = gradingScale;
            state.config = config;
            state.result = result;

            renderDashboard(result);
            renderRoadmap(result);
            renderAnalytics(result);
            renderPriorities(result);
            activateSimulator(result);

            if (state.studyPlanGenerated) {
                renderStudyPlan(result);
            } else {
                show(get("studyEmptyState"));
                hide(get("studyContent"));
            }

            updateAchievementStatuses();
            showFormSuccess("Your academic roadmap has been generated successfully.");

            saveCurrentForm();

            roadmapScroll();

            notify("Your academic roadmap is ready.");

        } catch (error) {
            showFormError(error.message || "Something went wrong. Please check your entries.");
            notify(error.message || "Please check your academic details.", "error");
        }
    }

    function roadmapScroll() {
        const roadmap = get("roadmap");

        if (!roadmap) return;

        window.setTimeout(() => {
            roadmap.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 100);
    }

    /* =====================================================
       21. DEMO DATA
    ===================================================== */

    function loadDemoData() {
        const demoSubjects = [
            {
                name: "Mathematics",
                credits: 4,
                cia1: 15,
                cia2: 16,
                ese: ""
            },
            {
                name: "Computer Science",
                credits: 4,
                cia1: 18,
                cia2: 17,
                ese: ""
            },
            {
                name: "Programming in C",
                credits: 4,
                cia1: 17,
                cia2: 18,
                ese: ""
            },
            {
                name: "Statistics",
                credits: 3,
                cia1: 14,
                cia2: 15,
                ese: ""
            },
            {
                name: "English",
                credits: 2,
                cia1: 18,
                cia2: 17,
                ese: ""
            },
            {
                name: "Environmental Studies",
                credits: 2,
                cia1: 16,
                cia2: 17,
                ese: ""
            }
        ];

        demoSubjects.forEach((subject, index) => {
            get(`subjectName${index}`).value = subject.name;
            get(`credits${index}`).value = subject.credits;
            get(`cia1_${index}`).value = subject.cia1;
            get(`cia2_${index}`).value = subject.cia2;
            get(`ese_${index}`).value = subject.ese;
        });

        get("targetSgpa").value = "8.5";
        get("targetSgpaSlider").value = "8.5";
        get("semesterSelect").value = "1";

        get("previousCgpa").value = "";
        get("previousCredits").value = "";

        get("universityName").value = "custom";

        updateTotalMaximum();
        saveCurrentForm();

        notify("Hypothetical demo data loaded. Edit it with your own marks before relying on the results.");
    }

    /* =====================================================
       22. FORM RESET
    ===================================================== */

    function resetAllResults() {
        state.subjects = [];
        state.gradingScale = [];
        state.config = null;
        state.result = null;
        state.studyPlanGenerated = false;
        state.studyAllocations = [];

        hide(get("roadmap"));
        show(get("dashboardEmptyState"));
        show(get("analyticsEmptyState"));
        hide(get("analyticsContent"));
        show(get("priorityEmptyState"));
        hide(get("priorityContent"));
        show(get("simulatorEmptyState"));
        hide(get("simulatorContent"));
        show(get("studyEmptyState"));
        hide(get("studyContent"));

        setText("currentSgpa", "--");
        setText("dashboardTarget", "--");
        setText("totalCredits", "--");
        setText("priorityCount", "--");
        setText("currentSgpaNote", "Calculate your performance");

        updateAchievementStatuses();

        safeStorage.remove(STORAGE_KEY);
        updateSaveStatus("Your academic data has been cleared.", true);
    }

    function resetFormToDefaults() {
        const form = get("academicForm");
        if (!form) return;

        form.reset();

        updateTotalMaximum();

        setText("formFeedback", "");
        hide(get("formFeedback"));

        resetAllResults();

        notify("Your form has been reset.");
    }

    /* =====================================================
       23. RESET CONFIRMATION DIALOG
    ===================================================== */

    const resetModal = get("resetConfirmationModal");

    get("resetForm")?.addEventListener("click", (event) => {
        /*
           The reset button is type="reset".
           Prevent the immediate reset so the user can confirm.
        */
        event.preventDefault();

        if (resetModal?.showModal) {
            resetModal.showModal();
        } else {
            resetFormToDefaults();
        }
    });

    get("cancelReset")?.addEventListener("click", () => {
        resetModal?.close();
    });

    get("confirmReset")?.addEventListener("click", () => {
        resetModal?.close();
        resetFormToDefaults();
    });

    /* =====================================================
       24. INPUT SYNCHRONISATION
    ===================================================== */

    function updateTotalMaximum() {
        const cia1 = number(get("cia1Max")?.value);
        const cia2 = number(get("cia2Max")?.value);
        const ese = number(get("eseMax")?.value);

        if (cia1 === null || cia2 === null || ese === null) return;

        const total = cia1 + cia2 + ese;

        if (get("totalMax")) {
            get("totalMax").value = total;
        }

        for (let index = 0; index < SUBJECT_COUNT; index++) {
            const cia1Input = get(`cia1_${index}`);
            const cia2Input = get(`cia2_${index}`);
            const eseInput = get(`ese_${index}`);

            if (cia1Input) {
                cia1Input.max = String(cia1);
                cia1Input.placeholder = `0–${cia1}`;
            }

            if (cia2Input) {
                cia2Input.max = String(cia2);
                cia2Input.placeholder = `0–${cia2}`;
            }

            if (eseInput) {
                eseInput.max = String(ese);
                eseInput.placeholder = `0–${ese}`;
            }
        }

        const hint = get("totalMarksHint");

        if (hint) {
            hint.textContent =
                `Total = ${cia1} + ${cia2} + ${ese} = ${total} marks.`;
        }
    }

    const targetInput = get("targetSgpa");
    const targetSlider = get("targetSgpaSlider");

    targetInput?.addEventListener("input", () => {
        const value = number(targetInput.value);

        if (value !== null && targetSlider) {
            targetSlider.value = String(clamp(value, 0, 10));
        }
    });

    targetSlider?.addEventListener("input", () => {
        if (targetInput) {
            targetInput.value = targetSlider.value;
        }
    });

    ["cia1Max", "cia2Max", "eseMax"].forEach((id) => {
        get(id)?.addEventListener("input", updateTotalMaximum);
    });

    /* =====================================================
       25. FORM EVENT LISTENERS
    ===================================================== */

    get("academicForm")?.addEventListener("submit", generateRoadmap);

    get("loadDemoData")?.addEventListener("click", loadDemoData);

    get("editAcademicData")?.addEventListener("click", () => {
        get("planner")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    get("downloadReport")?.addEventListener(
        "click",
        downloadAcademicReport
    );

    get("generateStudyPlan")?.addEventListener("click", () => {
        if (!state.result) {
            notify("Generate your academic roadmap first.", "error");
            return;
        }

        renderStudyPlan(state.result, true);
        saveCurrentForm();
    });

    get("simulatorSubject")?.addEventListener("change", () => {
        const index = Number(get("simulatorSubject").value);

        if (!state.result || !Number.isInteger(index)) return;

        const subject = state.result.subjects[index];

        const marks = subject.ese ??
            getEstimatedEse(
                subject,
                state.result.config,
                "expected"
            );

        const slider = get("eseSimulatorSlider");

        if (slider) slider.value = String(marks);

        updateSimulator();
    });

    get("eseSimulatorSlider")?.addEventListener(
        "input",
        updateSimulator
    );

    get("resetSimulator")?.addEventListener(
        "click",
        resetSimulation
    );

    /* =====================================================
       26. CHECKLIST PERSISTENCE
    ===================================================== */

    const CHECKLIST_KEY = "grademate-checklist-v1";

    function loadChecklist() {
        const saved = safeStorage.get(CHECKLIST_KEY);

        if (!saved) return;

        try {
            const values = JSON.parse(saved);
            const checkboxes = $$('input[name="studyTask"]');

            checkboxes.forEach((checkbox, index) => {
                checkbox.checked = Boolean(values[index]);
            });
        } catch (error) {
            console.warn("Could not restore checklist:", error);
        }
    }

    function saveChecklist() {
        const values = $$('input[name="studyTask"]')
            .map((checkbox) => checkbox.checked);

        safeStorage.set(CHECKLIST_KEY, JSON.stringify(values));
    }

    $$('input[name="studyTask"]').forEach((checkbox) => {
        checkbox.addEventListener("change", saveChecklist);
    });

    /* =====================================================
       27. LOCAL DATA SAVE & RESTORE
    ===================================================== */

    function collectFormData() {
        const form = get("academicForm");
        if (!form) return null;

        const formData = new FormData(form);

        return {
            fields: Object.fromEntries(formData.entries()),
            subjects: Array.from(
                { length: SUBJECT_COUNT },
                (_, index) => ({
                    name: get(`subjectName${index}`)?.value ?? "",
                    credits: get(`credits${index}`)?.value ?? "",
                    cia1: get(`cia1_${index}`)?.value ?? "",
                    cia2: get(`cia2_${index}`)?.value ?? "",
                    ese: get(`ese_${index}`)?.value ?? ""
                })
            ),
            grading: $$("#gradingTableBody tr").map((row) =>
                $$("input", row).map((input) => input.value)
            ),
            target: get("targetSgpa")?.value ?? "8.5",
            semester: get("semesterSelect")?.value ?? "1",
            university: get("universityName")?.value ?? "custom"
        };
    }

    function restoreFormData() {
        const saved = safeStorage.get(STORAGE_KEY);
        if (!saved) return false;

        try {
            const data = JSON.parse(saved);

            if (data.fields) {
                Object.entries(data.fields).forEach(([name, value]) => {
                    const field = get(name) ||
                        $(`[name="${CSS.escape(name)}"]`);

                    if (field && field.type !== "submit") {
                        field.value = value;
                    }
                });
            }

            if (Array.isArray(data.subjects)) {
                data.subjects.forEach((subject, index) => {
                    if (index >= SUBJECT_COUNT) return;

                    get(`subjectName${index}`).value = subject.name ?? "";
                    get(`credits${index}`).value = subject.credits ?? "";
                    get(`cia1_${index}`).value = subject.cia1 ?? "";
                    get(`cia2_${index}`).value = subject.cia2 ?? "";
                    get(`ese_${index}`).value = subject.ese ?? "";
                });
            }

            if (Array.isArray(data.grading)) {
                const rows = $$("#gradingTableBody tr");

                data.grading.forEach((values, index) => {
                    if (!rows[index]) return;

                    $$("input", rows[index]).forEach((input, inputIndex) => {
                        if (values[inputIndex] !== undefined) {
                            input.value = values[inputIndex];
                        }
                    });
                });
            }

            if (data.target !== undefined) {
                get("targetSgpa").value = data.target;
                get("targetSgpaSlider").value = data.target;
            }

            if (data.semester) {
                get("semesterSelect").value = data.semester;
            }

            if (data.university) {
                get("universityName").value = data.university;
            }

            updateTotalMaximum();
            updateSaveStatus("Your previously saved data has been restored.", true);

            return true;
        } catch (error) {
            console.warn("Saved data could not be restored:", error);
            updateSaveStatus("Saved data could not be restored.", false);
            return false;
        }
    }

    /*
       Save changes locally as the student edits the form.
       No information is sent to a server.
    */

    get("academicForm")?.addEventListener("input", (event) => {
        if (event.target.id === "totalMax") return;

        if (event.target.id === "targetSgpa") {
            if (targetSlider) {
                targetSlider.value = event.target.value;
            }
        }

        saveCurrentForm();
    });

    get("academicForm")?.addEventListener("change", saveCurrentForm);

    /* =====================================================
       28. WINDOW RESIZE — REDRAW CHARTS
    ===================================================== */

    let resizeFrame = null;

    window.addEventListener("resize", () => {
        if (!state.result) return;

        if (resizeFrame) {
            cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {
            drawCharts(state.result);
        });
    });

    /* =====================================================
       29. INITIALISE APPLICATION
    ===================================================== */

    function initialise() {
        setText("currentYear", String(new Date().getFullYear()));

        updateTotalMaximum();
        loadChecklist();

        const restored = restoreFormData();

        if (restored) {
            notify("Your saved academic inputs have been restored.");
        }

        /*
           Keep the dashboard in its empty state until the
           student explicitly generates a roadmap.
        */

        show(get("dashboardEmptyState"));
        show(get("analyticsEmptyState"));
        show(get("priorityEmptyState"));
        show(get("simulatorEmptyState"));
        show(get("studyEmptyState"));

        hide(get("analyticsContent"));
        hide(get("priorityContent"));
        hide(get("simulatorContent"));
        hide(get("studyContent"));
        hide(get("roadmap"));

        updateAchievementStatuses();
    }

    initialise();
});