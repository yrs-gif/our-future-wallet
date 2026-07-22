const THEME_STORAGE_KEY = "ninero-theme";
const TRANSACTIONS_STORAGE_KEY = "ninero-transactions-v2";

const state = {
    currentUserId: "yachi",
    searchTerm: "",
    sharedGoal: {
        label: "Fondo para viaje",
        saved: 0,
        target: 0
    },
    profiles: {
        yachi: {
            id: "yachi",
            displayName: "Mi Yachi",
            email: "yachi@example.com",
            viewId: "profile-me",
            trend: [32, 48, 44, 68, 58, 82, 74, 88, 79],
            budget: [
                { name: "Renta y servicios", limit: 0, spent: 0 },
                { name: "Comida", limit: 0, spent: 0 },
                { name: "Ahorro personal", limit: 0, spent: 0 }
            ]
        },
        ushi: {
            id: "ushi",
            displayName: "Mi Ushi",
            email: "ushi@example.com",
            viewId: "profile-einar",
            trend: [44, 38, 58, 52, 76, 66, 88, 73, 91],
            budget: [
                { name: "Hogar compartido", limit: 0, spent: 0 },
                { name: "Auto y transporte", limit: 0, spent: 0 },
                { name: "Ahorro comun", limit: 0, spent: 0 }
            ]
        }
    },
    monthlyFlow: [
        { month: "Ene", income: 0, expense: 0 },
        { month: "Feb", income: 0, expense: 0 },
        { month: "Mar", income: 0, expense: 0 },
        { month: "Abr", income: 0, expense: 0 },
        { month: "May", income: 0, expense: 0 },
        { month: "Jun", income: 0, expense: 0 }
    ],
    savingsTrend: [0, 0, 0, 0, 0, 0, 0],
    transactions: []
};

const categoryOptions = ["Ingreso", "Hogar", "Comida", "Transporte", "Ahorro", "Gustos", "Salud", "General"];
const categoryColors = {
    Hogar: "#35e6cf",
    Comida: "#ff4f8b",
    Transporte: "#7c5cff",
    Ahorro: "#65f28c",
    Gustos: "#ffd166",
    Salud: "#74ddc5",
    General: "#a892ff"
};

document.addEventListener("DOMContentLoaded", () => {
    restorePersistedData();
    initializeTheme();
    initializeNavigation();
    initializeForms();
    initializeSearch();
    initializeActions();
    hydrateSessionUI();
    renderAll();
});

function initializeTheme() {
    const savedTheme = readStorage(THEME_STORAGE_KEY) || "retro";
    const themeToggle = document.getElementById("themeToggle");

    applyTheme(savedTheme);
    themeToggle.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "kawaii" ? "retro" : "kawaii";
        applyTheme(nextTheme);
        writeStorage(THEME_STORAGE_KEY, nextTheme);
    });
}

function applyTheme(theme) {
    const normalizedTheme = theme === "kawaii" ? "kawaii" : "retro";
    const isKawaii = normalizedTheme === "kawaii";
    const themeToggle = document.getElementById("themeToggle");

    document.documentElement.dataset.theme = normalizedTheme;
    document.getElementById("themeName").textContent = isKawaii ? "Pastel kawaii" : "Retro terminal";
    themeToggle.setAttribute("aria-pressed", String(isKawaii));
    themeToggle.setAttribute("aria-label", isKawaii ? "Cambiar a tema retro" : "Cambiar a tema kawaii");
}

function initializeNavigation() {
    document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => setActiveView(button.dataset.view));
    });

    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
        panel.hidden = !panel.classList.contains("active");
    });

    const initialView = window.location.hash.replace("#", "");
    if (document.getElementById(initialView)) {
        setActiveView(initialView, { updateHash: false });
    }

    window.addEventListener("hashchange", () => {
        setActiveView(window.location.hash.replace("#", ""), { updateHash: false });
    });
}

function setActiveView(viewId, options = { updateHash: true }) {
    const nextView = document.getElementById(viewId) ? viewId : "dashboard";

    document.querySelectorAll("[data-view]").forEach((button) => {
        const isActive = button.dataset.view === nextView;
        button.classList.toggle("active", isActive);
        button.toggleAttribute("aria-current", isActive);
    });

    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
        const isActive = panel.id === nextView;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
    });

    if (options.updateHash) {
        window.location.hash = nextView;
    }

    const activeProfile = Object.values(state.profiles).find((profile) => profile.viewId === nextView);
    if (activeProfile) {
        state.currentUserId = activeProfile.id;
        hydrateSessionUI();
    }

    document.getElementById("appContent").focus({ preventScroll: true });
}

function initializeForms() {
    document.querySelectorAll("[data-category-select]").forEach((select) => {
        select.innerHTML = categoryOptions.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    });

    document.querySelectorAll("[data-transaction-form]").forEach((form) => {
        const dateInput = form.querySelector('input[name="createdAt"]');
        dateInput.value = new Date().toISOString().slice(0, 10);
        syncCategoryField(form);

        form.querySelectorAll('input[name="type"]').forEach((input) => {
            input.addEventListener("change", () => syncCategoryField(form));
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const ownerId = form.dataset.owner;
            const type = formData.get("type");
            const description = String(formData.get("description") || "").trim();
            const amount = Number(formData.get("amount"));

            if (!description) {
                showToast("Agrega un concepto para guardar el movimiento");
                form.querySelector('input[name="description"]').focus();
                return;
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                showToast("El monto debe ser mayor a cero");
                form.querySelector('input[name="amount"]').focus();
                return;
            }

            await addTransaction({
                ownerId,
                type,
                description,
                category: type === "income" ? "Ingreso" : formData.get("category"),
                amount,
                createdAt: formData.get("createdAt") || new Date().toISOString().slice(0, 10),
                note: String(formData.get("note") || "").trim()
            });

            form.reset();
            form.querySelector('input[value="income"]').checked = true;
            dateInput.value = new Date().toISOString().slice(0, 10);
            syncCategoryField(form);
            renderAll();
            showToast("Movimiento guardado");
        });
    });
}

function syncCategoryField(form) {
    const type = form.querySelector('input[name="type"]:checked')?.value || "income";
    const categorySelect = form.querySelector("[data-category-select]");

    if (!categorySelect) {
        return;
    }

    categorySelect.disabled = type === "income";
    categorySelect.value = type === "income" ? "Ingreso" : categorySelect.value === "Ingreso" ? "General" : categorySelect.value;
}

function initializeSearch() {
    const searchInput = document.getElementById("globalSearch");
    const clearButton = document.getElementById("clearSearch");

    searchInput.addEventListener("input", () => {
        state.searchTerm = searchInput.value.trim().toLowerCase();
        clearButton.hidden = !state.searchTerm;
        renderTransactions();
    });

    clearButton.addEventListener("click", () => {
        searchInput.value = "";
        state.searchTerm = "";
        clearButton.hidden = true;
        renderTransactions();
        searchInput.focus();
    });
}

function initializeActions() {
    document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;

            if (action === "new-transaction") {
                const activeView = document.querySelector("[data-view-panel].active")?.id;
                const targetView = activeView === "profile-einar" ? "profile-einar" : "profile-me";
                const form = document.querySelector(`#${targetView} [data-transaction-form]`);
                setActiveView(targetView);
                form?.scrollIntoView({ behavior: "smooth", block: "center" });
                form?.querySelector('input[name="description"]')?.focus({ preventScroll: true });
            }

            if (action === "mock-export") {
                exportMockData();
            }
        });
    });

    document.addEventListener("click", async (event) => {
        const deleteButton = event.target.closest("[data-delete-transaction]");
        if (!deleteButton) {
            return;
        }

        await deleteTransaction(deleteButton.dataset.deleteTransaction);
        renderAll();
        showToast("Movimiento eliminado");
    });
}

function hydrateSessionUI() {
    const user = state.profiles[state.currentUserId];
    document.getElementById("activeUserName").textContent = user.displayName;
    document.getElementById("activeUserEmail").textContent = user.email;
}

function restorePersistedData() {
    const savedTransactions = readJsonStorage(TRANSACTIONS_STORAGE_KEY);
    if (Array.isArray(savedTransactions)) {
        state.transactions = savedTransactions.filter(isValidTransaction);
    }
}

async function renderAll() {
    const dashboardData = await fetchDashboardData();
    renderDashboardMetrics(dashboardData);
    renderGoal();
    renderMonthlyChart();
    renderCategoryChart(dashboardData.expensesByCategory);
    renderSavingTrend();
    renderProfiles();
    renderTransactions();
    refreshIcons();
}

function renderDashboardMetrics(data) {
    setText('[data-summary="shared.balance"]', formatCurrency(data.balance));
    setText('[data-summary="shared.income"]', formatCurrency(data.totalIncome));
    setText('[data-summary="shared.expenses"]', formatCurrency(data.totalExpenses));
}

function renderGoal() {
    const percent = state.sharedGoal.target > 0
        ? Math.min(Math.round((state.sharedGoal.saved / state.sharedGoal.target) * 100), 100)
        : 0;
    const remaining = Math.max(state.sharedGoal.target - state.sharedGoal.saved, 0);
    const monthlySuggestion = Math.ceil(remaining / 4);

    setText("[data-goal-percent]", `${percent}%`);
    setText("[data-goal-saved]", `${formatCurrency(state.sharedGoal.saved)} ahorrados`);
    setText("[data-goal-target]", `${formatCurrency(state.sharedGoal.target)} meta`);
    setText("[data-goal-remaining]", formatCurrency(remaining));
    setText("[data-goal-monthly]", `${formatCurrency(monthlySuggestion)} / mes`);
    document.querySelector("[data-goal-progress]").style.width = `${percent}%`;
}

function renderMonthlyChart() {
    const chart = document.getElementById("monthlyChart");
    const maxValue = Math.max(...state.monthlyFlow.flatMap((item) => [item.income, item.expense]), 1);

    chart.innerHTML = state.monthlyFlow.map((item) => {
        const incomeHeight = Math.round((item.income / maxValue) * 100);
        const expenseHeight = Math.round((item.expense / maxValue) * 100);

        return `
            <div class="bar-group" title="${item.month}">
                <span class="bar income" style="height:${incomeHeight}%"></span>
                <span class="bar expense" style="height:${expenseHeight}%"></span>
                <small>${item.month}</small>
            </div>
        `;
    }).join("");
}

function renderCategoryChart(expensesByCategory) {
    const donut = document.getElementById("categoryDonut");
    const list = document.getElementById("categoryBreakdown");
    const entries = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

    if (!entries.length || total === 0) {
        donut.style.background = "var(--bg-panel-strong)";
        donut.dataset.label = "0%";
        list.innerHTML = '<li><span>Sin gastos</span><strong>$0.00</strong></li>';
        return;
    }

    let cursor = 0;
    const slices = entries.map(([category, amount]) => {
        const start = cursor;
        const percent = (amount / total) * 100;
        cursor += percent;
        const color = categoryColors[category] || categoryColors.General;
        return `${color} ${start}% ${cursor}%`;
    });

    donut.style.background = `conic-gradient(${slices.join(", ")})`;
    donut.dataset.label = `${Math.round((entries[0][1] / total) * 100)}%`;
    list.innerHTML = entries.slice(0, 5).map(([category, amount]) => `
        <li>
            <span><i class="dot" style="--dot-color:${categoryColors[category] || categoryColors.General}"></i>${escapeHtml(category)}</span>
            <strong>${formatCurrency(amount)}</strong>
        </li>
    `).join("");
}

function renderSavingTrend() {
    const chart = document.getElementById("savingTrend");
    const points = valuesToPoints(state.savingsTrend, 320, 150, 12);
    const linePath = pointsToPath(points);
    const areaPath = `${linePath} L308 150 L12 150Z`;

    chart.innerHTML = `
        <svg viewBox="0 0 320 160" role="img" aria-label="Ahorro acumulado">
            <path class="grid-line" d="M12 30H308M12 80H308M12 130H308"></path>
            <path class="area-fill" d="${areaPath}"></path>
            <path class="area-line" d="${linePath}"></path>
        </svg>
    `;
}

function renderProfiles() {
    Object.values(state.profiles).forEach((profile) => {
        const summary = getSummary(profile.id);
        const available = summary.income - summary.expenses;
        const saveRate = summary.income ? Math.max(0, Math.round((available / summary.income) * 100)) : 0;

        document.querySelector(`[data-profile-stats="${profile.id}"]`).innerHTML = [
            { label: "Disponible", value: formatCurrency(available) },
            { label: "Control", value: `${saveRate}%` },
            { label: "Ahorro", value: formatCurrency(getBudgetAmount(profile.id, "Ahorro")) }
        ].map(renderFocusStat).join("");

        document.querySelector(`[data-profile-summary="${profile.id}"]`).innerHTML = [
            { label: "Ingresos", value: formatCurrency(summary.income) },
            { label: "Gastos", value: formatCurrency(summary.expenses) },
            { label: "Libre", value: formatCurrency(available) }
        ].map(renderMiniMetric).join("");

        renderBudget(profile);
        renderSparkline(profile);
    });
}

function renderBudget(profile) {
    const list = document.getElementById(`${profile.id}Budget`);
    list.innerHTML = profile.budget.map((item) => {
        const percent = item.limit > 0
            ? Math.min(Math.round((item.spent / item.limit) * 100), 100)
            : 0;
        return `
            <div class="budget-item">
                <span>${escapeHtml(item.name)}</span>
                <strong>${formatCurrency(item.spent)}</strong>
                <div class="progress-wrap" aria-label="${escapeHtml(item.name)} ${percent}%">
                    <span style="width:${percent}%"></span>
                </div>
            </div>
        `;
    }).join("");
}

function renderSparkline(profile) {
    const chart = document.getElementById(`${profile.id}Trend`);
    chart.innerHTML = profile.trend.map((height) => `<span style="height:${height}%"></span>`).join("");
}

function renderFocusStat(item) {
    return `
        <div>
            <span>${item.label}</span>
            <strong>${item.value}</strong>
        </div>
    `;
}

function renderMiniMetric(item) {
    return `
        <div class="mini-metric">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
        </div>
    `;
}

function renderTransactions() {
    const filteredTransactions = getFilteredTransactions(state.transactions);
    renderTransactionList("globalTransactions", filteredTransactions.slice(0, 7));
    renderTransactionList("yachiTransactions", filteredTransactions.filter((transaction) => transaction.ownerId === "yachi").slice(0, 6));
    renderTransactionList("ushiTransactions", filteredTransactions.filter((transaction) => transaction.ownerId === "ushi").slice(0, 6));
    refreshIcons();
}

function renderTransactionList(elementId, transactions) {
    const list = document.getElementById(elementId);

    if (!transactions.length) {
        list.innerHTML = '<li class="transaction-item empty-state"><span class="transaction-icon"><i data-lucide="search-x"></i></span><div class="transaction-main"><strong>Sin resultados</strong><span>Ajusta tu busqueda</span></div></li>';
        return;
    }

    list.innerHTML = transactions.map((transaction) => {
        const owner = state.profiles[transaction.ownerId]?.displayName || "Pareja";
        const sign = transaction.type === "income" ? "+" : "-";
        const iconName = transaction.type === "income" ? "arrow-down-to-line" : "arrow-up-from-line";

        return `
            <li class="transaction-item">
                <span class="transaction-icon ${transaction.type}" aria-hidden="true">
                    <i data-lucide="${iconName}"></i>
                </span>
                <div class="transaction-main">
                    <strong>${escapeHtml(transaction.description)}</strong>
                    <span>${owner} / ${escapeHtml(transaction.category)} / ${formatDate(transaction.createdAt)}</span>
                </div>
                <span class="transaction-amount ${transaction.type}">
                    ${sign}${formatCurrency(transaction.amount)}
                </span>
                <button class="ghost-icon transaction-delete" type="button" data-delete-transaction="${transaction.id}" aria-label="Eliminar ${escapeHtml(transaction.description)}">
                    <i data-lucide="trash-2"></i>
                </button>
            </li>
        `;
    }).join("");
}

function getFilteredTransactions(transactions) {
    const sorted = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!state.searchTerm) {
        return sorted;
    }

    return sorted.filter((transaction) => {
        const owner = state.profiles[transaction.ownerId]?.displayName || "";
        return [transaction.description, transaction.category, owner, transaction.note]
            .join(" ")
            .toLowerCase()
            .includes(state.searchTerm);
    });
}

function getSummary(ownerId) {
    const transactions = ownerId ? state.transactions.filter((transaction) => transaction.ownerId === ownerId) : state.transactions;
    const income = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
        income,
        expenses,
        balance: income - expenses
    };
}

function getBudgetAmount(profileId, categoryName) {
    return state.profiles[profileId].budget
        .filter((item) => item.name.includes(categoryName))
        .reduce((sum, item) => sum + item.spent, 0);
}

function valuesToPoints(values, width, height, padding) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = (width - padding * 2) / (values.length - 1);

    return values.map((value, index) => {
        const x = padding + index * step;
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return [Number(x.toFixed(2)), Number(y.toFixed(2))];
    });
}

function pointsToPath(points) {
    return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = value;
    }
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("visible");

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
        toast.classList.remove("visible");
    }, 2400);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0
    }).format(value);
}

function formatDate(dateValue) {
    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short"
    }).format(new Date(`${dateValue}T12:00:00`));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Firebase-ready mocks. Replace internals with Firebase Auth and Firestore calls.
async function initializeFirebaseApp() {
    return {
        apiKey: "TU_API_KEY",
        authDomain: "TU_AUTH_DOMAIN",
        projectId: "TU_PROJECT_ID",
        storageBucket: "TU_STORAGE_BUCKET",
        messagingSenderId: "TU_MESSAGING_SENDER_ID",
        appId: "TU_APP_ID"
    };
}

async function getCurrentUser() {
    // Firebase Auth target:
    // return auth.currentUser;
    return state.profiles[state.currentUserId];
}

async function fetchDashboardData() {
    // Firestore target:
    // const querySnapshot = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc")));
    const summary = getSummary();
    const expensesByCategory = state.transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((groups, transaction) => {
            groups[transaction.category] = (groups[transaction.category] || 0) + transaction.amount;
            return groups;
        }, {});

    return {
        totalIncome: summary.income,
        totalExpenses: summary.expenses,
        balance: summary.balance,
        expensesByCategory,
        latestTransactions: getFilteredTransactions(state.transactions).slice(0, 7)
    };
}

async function fetchUserBudget(userId) {
    // Firestore target:
    // return getDoc(doc(db, "budgets", userId));
    return state.profiles[userId]?.budget || [];
}

async function addTransaction(transaction) {
    // Firestore target:
    // return addDoc(collection(db, "transactions"), { ...transaction, createdAt: serverTimestamp() });
    const savedTransaction = {
        id: createTransactionId(),
        category: transaction.category || "General",
        createdAt: new Date().toISOString().slice(0, 10),
        ...transaction
    };

    state.transactions = [savedTransaction, ...state.transactions];
    persistTransactions();
    return savedTransaction;
}

async function deleteTransaction(transactionId) {
    state.transactions = state.transactions.filter((transaction) => transaction.id !== transactionId);
    persistTransactions();
}

function persistTransactions() {
    writeStorage(TRANSACTIONS_STORAGE_KEY, JSON.stringify(state.transactions));
}

function exportMockData() {
    const summary = getSummary();
    const payload = {
        app: "Ninero",
        exportedAt: new Date().toISOString(),
        currency: "MXN",
        summary,
        sharedGoal: state.sharedGoal,
        profiles: state.profiles,
        transactions: state.transactions
    };
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ninero-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Exportacion descargada en JSON");
}

function isValidTransaction(transaction) {
    return transaction
        && typeof transaction.id === "string"
        && ["yachi", "ushi"].includes(transaction.ownerId)
        && ["income", "expense"].includes(transaction.type)
        && typeof transaction.description === "string"
        && Number.isFinite(Number(transaction.amount));
}

function createTransactionId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        showToast("No se pudo guardar en este navegador");
    }
}

function readJsonStorage(key) {
    const value = readStorage(key);
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function subscribeToTransactions(callback) {
    // Firestore target:
    // return onSnapshot(collection(db, "transactions"), snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    callback(state.transactions);
    return () => undefined;
}
