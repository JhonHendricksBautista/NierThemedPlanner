(() => {
  const STORAGE_KEY = "yorha-task-planner-v1";

  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  const dueInput = document.getElementById("task-due");
  const searchInput = document.getElementById("search-input");
  const clearFiltersBtn = document.getElementById("clear-filters");
  const list = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("task-count");
  const clearCompletedBtn = document.getElementById("clear-completed");
  const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
  const advButtons = Array.from(document.querySelectorAll(".chip-btn"));
  const template = document.getElementById("task-template");
  const subtaskTemplate = document.getElementById("subtask-template");
  const toastRegion = document.getElementById("toast-region");

  const calMonthEl = document.getElementById("cal-month");
  const calGridEl = document.getElementById("calendar-grid");
  const calPrevBtn = document.getElementById("cal-prev");
  const calNextBtn = document.getElementById("cal-next");
  const calTodayBtn = document.getElementById("cal-today");
  const activeDateFilterEl = document.getElementById("active-date-filter");
  const activeDateLabelEl = document.getElementById("active-date-label");
  const clearDateFilterBtn = document.getElementById("clear-date-filter");
  const agendaDateLabelEl = document.getElementById("agenda-date-label");
  const agendaContentEl = document.getElementById("agenda-content");

  const statTotal = document.getElementById("stat-total");
  const statActive = document.getElementById("stat-active");
  const statCompleted = document.getElementById("stat-completed");
  const statOverdue = document.getElementById("stat-overdue");

  let tasks = loadTasks();
  let currentFilter = "all";
  let selectedDate = null; // YYYY-MM-DD
  let calendarCursor = startOfMonth(new Date());
  let searchQuery = "";
  let advancedFilters = { overdue: false, today: false, hasSubtasks: false, noDueDate: false };
  let editingTaskId = null;
  let editingSubtask = null; // { taskId, subtaskId }
  let undoState = null; // { message, tasks, timer }

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function toDateKey(date) { const d = new Date(date); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseDateKey(key) {
    if (!key || typeof key !== "string") return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function todayKey() { return toDateKey(new Date()); }
  function addDays(key, days) {
    const d = parseDateKey(key);
    if (!d) return null;
    d.setDate(d.getDate() + days);
    return toDateKey(d);
  }

  function normalizeSubtask(s) {
    if (!s || typeof s.text !== "string") return null;
    const text = s.text.trim().slice(0, 100);
    if (!text) return null;
    return { id: String(s.id || uid()), text, completed: Boolean(s.completed) };
  }

  function normalizeTask(t) {
    if (!t || typeof t.text !== "string") return null;
    const text = String(t.text).trim().slice(0, 140);
    if (!text) return null;
    const due = typeof t.dueDate === "string" && parseDateKey(t.dueDate) ? t.dueDate : null;
    const subtasks = Array.isArray(t.subtasks) ? t.subtasks.map(normalizeSubtask).filter(Boolean) : [];
    return {
      id: String(t.id || uid()),
      text,
      completed: Boolean(t.completed),
      createdAt: Number(t.createdAt) || Date.now(),
      dueDate: due,
      subtasks
    };
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeTask).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function formatLoggedDate(ts) {
    try { return new Date(ts).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }
  function formatDueLabel(key) {
    const d = parseDateKey(key);
    if (!d) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function isOverdue(task) {
    return !task.completed && task.dueDate && task.dueDate < todayKey();
  }

  function matchesSearch(task, q) {
    if (!q) return true;
    const hay = [task.text, ...task.subtasks.map(s => s.text)].join("\n").toLowerCase();
    return hay.includes(q);
  }

  function getFilteredTasks() {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter(task => {
      if (currentFilter === "active" && task.completed) return false;
      if (currentFilter === "completed" && !task.completed) return false;
      if (selectedDate && task.dueDate !== selectedDate) return false;
      if (advancedFilters.overdue && !isOverdue(task)) return false;
      if (advancedFilters.today && task.dueDate !== todayKey()) return false;
      if (advancedFilters.hasSubtasks && task.subtasks.length === 0) return false;
      if (advancedFilters.noDueDate && task.dueDate) return false;
      if (!matchesSearch(task, q)) return false;
      return true;
    });
  }

  function showToast(message, onUndo) {
    if (undoState && undoState.timer) clearTimeout(undoState.timer);
    toastRegion.innerHTML = "";
    const toast = document.createElement("div");
    toast.className = "toast";
    const msg = document.createElement("span");
    msg.className = "toast-msg";
    msg.textContent = message;
    toast.appendChild(msg);
    if (onUndo) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost small";
      btn.textContent = "UNDO";
      btn.addEventListener("click", () => {
        if (undoState && undoState.timer) clearTimeout(undoState.timer);
        undoState = null;
        toastRegion.innerHTML = "";
        onUndo();
      });
      toast.appendChild(btn);
    }
    toastRegion.appendChild(toast);
    const timer = setTimeout(() => {
      undoState = null;
      if (toastRegion.contains(toast)) toastRegion.innerHTML = "";
    }, 5000);
    undoState = { timer };
  }

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const overdue = tasks.filter(isOverdue).length;
    const label = active === 1 ? "directive remaining" : "directives remaining";
    countEl.textContent = `${active} ${label}`;
    clearCompletedBtn.disabled = completed === 0;
    statTotal.textContent = String(total);
    statActive.textContent = String(active);
    statCompleted.textContent = String(completed);
    statOverdue.textContent = String(overdue);
  }

  function renderActiveDateFilter() {
    if (!selectedDate) {
      activeDateFilterEl.hidden = true;
      activeDateLabelEl.textContent = "";
      return;
    }
    activeDateFilterEl.hidden = false;
    activeDateLabelEl.textContent = `Date filter: ${formatDueLabel(selectedDate)}`;
  }

  function renderAgenda() {
    if (!selectedDate) {
      agendaDateLabelEl.textContent = "No date selected";
      agendaContentEl.innerHTML = `<p class="agenda-empty">Select a calendar date to inspect assigned directives.</p>`;
      return;
    }
    agendaDateLabelEl.textContent = formatDueLabel(selectedDate);
    const dayTasks = tasks
      .filter(t => t.dueDate === selectedDate)
      .sort((a, b) => Number(a.completed) - Number(b.completed) || a.createdAt - b.createdAt);

    if (dayTasks.length === 0) {
      agendaContentEl.innerHTML = `<p class="agenda-empty">No directives assigned to this date.</p>`;
      return;
    }

    agendaContentEl.innerHTML = "";
    dayTasks.forEach(task => {
      const item = document.createElement("div");
      item.className = "agenda-item" + (task.completed ? " done" : "");
      const title = document.createElement("p");
      title.className = "agenda-title";
      title.textContent = task.text;
      const meta = document.createElement("div");
      meta.className = "agenda-meta";
      const parts = [];
      parts.push(task.completed ? "Completed" : (isOverdue(task) ? "Overdue" : "Active"));
      if (task.subtasks.length) {
        const done = task.subtasks.filter(s => s.completed).length;
        parts.push(`Sub ${done}/${task.subtasks.length}`);
      }
      meta.textContent = parts.join(" // ");
      item.appendChild(title);
      item.appendChild(meta);
      agendaContentEl.appendChild(item);
    });
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const startDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    calMonthEl.textContent = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();

    const dueCounts = new Map();
    const overdueByDate = new Set();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      dueCounts.set(t.dueDate, (dueCounts.get(t.dueDate) || 0) + 1);
      if (isOverdue(t)) overdueByDate.add(t.dueDate);
    });

    const tk = todayKey();
    calGridEl.innerHTML = "";

    const prevMonthEnd = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthEnd - i);
      calGridEl.appendChild(makeDayCell(d, true, tk, dueCounts, overdueByDate));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calGridEl.appendChild(makeDayCell(new Date(year, month, day), false, tk, dueCounts, overdueByDate));
    }
    const totalCells = startDay + daysInMonth;
    const remainder = totalCells % 7;
    const nextDays = remainder === 0 ? 0 : 7 - remainder;
    for (let day = 1; day <= nextDays; day++) {
      calGridEl.appendChild(makeDayCell(new Date(year, month + 1, day), true, tk, dueCounts, overdueByDate));
    }
  }

  function makeDayCell(date, muted, tk, dueCounts, overdueByDate) {
    const key = toDateKey(date);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    if (muted) btn.classList.add("muted");
    if (key === tk) btn.classList.add("today");
    if (key === selectedDate) btn.classList.add("selected");
    if (overdueByDate.has(key)) btn.classList.add("has-overdue");
    btn.dataset.date = key;
    btn.setAttribute("aria-label", `Date ${formatDueLabel(key)}`);

    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = String(date.getDate());
    btn.appendChild(num);

    const count = dueCounts.get(key) || 0;
    const marks = document.createElement("span");
    marks.className = "day-marks";
    if (count > 0) {
      const mark = document.createElement("span");
      mark.className = "day-mark";
      mark.textContent = String(count);
      marks.appendChild(mark);
    }
    if (overdueByDate.has(key)) {
      const dot = document.createElement("span");
      dot.className = "overdue-dot";
      dot.title = "Overdue";
      marks.appendChild(dot);
    }
    if (marks.childNodes.length) btn.appendChild(marks);
    return btn;
  }

  function taskBadges(task, query) {
    const badges = [];
    if (task.dueDate) {
      if (isOverdue(task)) badges.push({ text: "OVERDUE", cls: "overdue" });
      else if (task.dueDate === todayKey()) badges.push({ text: "DUE TODAY", cls: "today" });
      else badges.push({ text: `DUE ${formatDueLabel(task.dueDate)}`, cls: "" });
    } else {
      badges.push({ text: "NO DUE DATE", cls: "" });
    }
    if (query && matchesSearch(task, query)) badges.push({ text: "MATCH", cls: "match" });
    return badges;
  }

  function renderTasks() {
    const visible = getFilteredTasks();
    const q = searchQuery.trim().toLowerCase();
    list.innerHTML = "";

    visible.forEach(task => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.id = task.id;
      if (task.completed) node.classList.add("completed");

      const checkbox = node.querySelector(".task-toggle");
      const textEl = node.querySelector(".task-text");
      const dateEl = node.querySelector(".task-date");
      const badgesEl = node.querySelector(".task-badges");
      const progressText = node.querySelector(".subtask-progress-text");
      const progressFill = node.querySelector(".subtask-progress-fill");
      const progressWrap = node.querySelector(".subtask-progress-wrap");
      const editBtn = node.querySelector(".task-edit");
      const deleteBtn = node.querySelector(".task-delete");
      const editForm = node.querySelector(".task-edit-form");
      const editText = node.querySelector(".edit-text");
      const editDue = node.querySelector(".edit-due");
      const subtaskList = node.querySelector(".subtask-list");
      const subtaskForm = node.querySelector(".subtask-form");

      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", `Mark directive as ${task.completed ? "active" : "completed"}`);
      textEl.textContent = task.text;
      dateEl.textContent = `Logged ${formatLoggedDate(task.createdAt)}`;

      taskBadges(task, q).forEach(b => {
        const span = document.createElement("span");
        span.className = "badge" + (b.cls ? ` ${b.cls}` : "");
        span.textContent = b.text;
        badgesEl.appendChild(span);
      });

      const totalSubs = task.subtasks.length;
      const doneSubs = task.subtasks.filter(s => s.completed).length;
      if (totalSubs > 0) {
        const pct = Math.round((doneSubs / totalSubs) * 100);
        progressText.textContent = `Sub-directives: ${doneSubs}/${totalSubs}`;
        progressFill.style.width = `${pct}%`;
        progressWrap.hidden = false;
        progressWrap.setAttribute("aria-hidden", "false");
      } else {
        progressText.textContent = "No sub-directives";
        progressFill.style.width = "0%";
        progressWrap.hidden = true;
        progressWrap.setAttribute("aria-hidden", "true");
      }

      task.subtasks.forEach(sub => {
        const sNode = subtaskTemplate.content.firstElementChild.cloneNode(true);
        sNode.dataset.subtaskId = sub.id;
        if (sub.completed) sNode.classList.add("completed");
        const sCheck = sNode.querySelector(".subtask-toggle");
        const sText = sNode.querySelector(".subtask-text");
        const sEditInput = sNode.querySelector(".subtask-edit-input");
        const sEditBtn = sNode.querySelector(".subtask-edit");
        const sDelBtn = sNode.querySelector(".subtask-delete");

        sCheck.checked = sub.completed;
        sText.textContent = sub.text;
        sEditInput.value = sub.text;

        const isEditingSub = editingSubtask && editingSubtask.taskId === task.id && editingSubtask.subtaskId === sub.id;
        if (isEditingSub) {
          sText.hidden = true;
          sEditInput.hidden = false;
          sEditBtn.textContent = "SAVE";
          sEditBtn.title = "Save sub-directive";
        } else {
          sText.hidden = false;
          sEditInput.hidden = true;
          sEditBtn.textContent = "EDIT";
        }

        sCheck.setAttribute("aria-label", `Mark sub-directive as ${sub.completed ? "active" : "completed"}`);
        sEditBtn.setAttribute("aria-label", isEditingSub ? `Save sub-directive` : `Edit sub-directive: ${sub.text}`);
        sDelBtn.setAttribute("aria-label", `Delete sub-directive: ${sub.text}`);
        subtaskList.appendChild(sNode);
      });

      const isEditing = editingTaskId === task.id;
      editForm.hidden = !isEditing;
      if (isEditing) {
        editText.value = task.text;
        editDue.value = task.dueDate || "";
      }
      editBtn.setAttribute("aria-label", `Edit directive: ${task.text}`);
      deleteBtn.setAttribute("aria-label", `Delete directive: ${task.text}`);
      subtaskForm.dataset.taskId = task.id;

      list.appendChild(node);
    });

    const hasAny = tasks.length > 0;
    const hasVisible = visible.length > 0;
    emptyState.hidden = hasVisible;
    const titleEl = emptyState.querySelector(".empty-title");
    const subEl = emptyState.querySelector(".empty-sub");
    if (!hasAny) {
      titleEl.textContent = "NO DIRECTIVES LOGGED";
      subEl.textContent = "Awaiting mission parameters from command.";
    } else if (!hasVisible) {
      titleEl.textContent = "NO MATCHING DIRECTIVES";
      subEl.textContent = "Adjust search, status, advanced filters, or date selection.";
    }
  }

  function render() {
    // Clean invalid edit states if targets disappeared
    if (editingTaskId && !tasks.some(t => t.id === editingTaskId)) editingTaskId = null;
    if (editingSubtask) {
      const t = tasks.find(x => x.id === editingSubtask.taskId);
      if (!t || !t.subtasks.some(s => s.id === editingSubtask.subtaskId)) editingSubtask = null;
    }
    renderActiveDateFilter();
    renderTasks();
    renderCalendar();
    renderAgenda();
    updateStats();
    syncFilterButtons();
  }

  function syncFilterButtons() {
    filterButtons.forEach(btn => {
      const active = btn.dataset.filter === currentFilter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    advButtons.forEach(btn => {
      const key = btn.dataset.adv;
      const pressed = !!advancedFilters[key];
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    });
  }

  function addTask(text, dueDate) {
    const trimmed = text.trim();
    if (!trimmed) return;
    tasks.unshift({
      id: uid(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
      dueDate: dueDate && parseDateKey(dueDate) ? dueDate : null,
      subtasks: []
    });
    saveTasks();
    render();
  }

  function updateTask(id, updater) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    updater(task);
    saveTasks();
    render();
  }

  function deleteTaskWithUndo(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const [removed] = tasks.splice(idx, 1);
    if (editingTaskId === id) editingTaskId = null;
    if (editingSubtask && editingSubtask.taskId === id) editingSubtask = null;
    saveTasks();
    render();
    showToast("Directive deleted", () => {
      // restore if not already present
      if (!tasks.some(t => t.id === removed.id)) {
        tasks.splice(Math.min(idx, tasks.length), 0, removed);
        saveTasks();
        render();
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value, dueInput.value);
    input.value = "";
    dueInput.value = "";
    input.focus();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value || "";
    render();
  });

  list.addEventListener("change", (e) => {
    const target = e.target;
    const taskItem = target.closest(".task-item");
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;

    if (target.classList.contains("task-toggle")) {
      updateTask(taskId, t => { t.completed = target.checked; });
      return;
    }
    if (target.classList.contains("subtask-toggle")) {
      const subItem = target.closest(".subtask-item");
      if (!subItem) return;
      const subId = subItem.dataset.subtaskId;
      updateTask(taskId, t => {
        const sub = t.subtasks.find(s => s.id === subId);
        if (sub) sub.completed = target.checked;
      });
    }
  });

  list.addEventListener("click", (e) => {
    const taskItem = e.target.closest(".task-item");
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;

    const editBtn = e.target.closest(".task-edit");
    if (editBtn) {
      editingTaskId = editingTaskId === taskId ? null : taskId;
      render();
      if (editingTaskId === taskId) {
        const field = list.querySelector(`.task-item[data-id="${CSS.escape(taskId)}"] .edit-text`);
        if (field) field.focus();
      }
      return;
    }

    const cancelBtn = e.target.closest(".edit-cancel");
    if (cancelBtn) {
      editingTaskId = null;
      render();
      return;
    }

    const quickBtn = e.target.closest(".quick-date");
    if (quickBtn) {
      const formEl = quickBtn.closest(".task-edit-form");
      const dueEl = formEl && formEl.querySelector(".edit-due");
      if (!dueEl) return;
      const q = quickBtn.dataset.q;
      const tk = todayKey();
      if (q === "today") dueEl.value = tk;
      else if (q === "tomorrow") dueEl.value = addDays(tk, 1) || "";
      else if (q === "nextweek") dueEl.value = addDays(tk, 7) || "";
      else if (q === "clear") dueEl.value = "";
      return;
    }

    const delTaskBtn = e.target.closest(".task-delete");
    if (delTaskBtn) {
      deleteTaskWithUndo(taskId);
      return;
    }

    const subEditBtn = e.target.closest(".subtask-edit");
    if (subEditBtn) {
      const subItem = e.target.closest(".subtask-item");
      if (!subItem) return;
      const subId = subItem.dataset.subtaskId;
      const isEditingThis = editingSubtask && editingSubtask.taskId === taskId && editingSubtask.subtaskId === subId;
      if (isEditingThis) {
        // save
        const inputEl = subItem.querySelector(".subtask-edit-input");
        const newText = (inputEl.value || "").trim().slice(0, 100);
        if (!newText) return;
        updateTask(taskId, t => {
          const sub = t.subtasks.find(s => s.id === subId);
          if (sub) sub.text = newText;
        });
        editingSubtask = null;
        render();
      } else {
        editingSubtask = { taskId, subtaskId: subId };
        render();
        const inputEl = list.querySelector(`.task-item[data-id="${CSS.escape(taskId)}"] .subtask-item[data-subtask-id="${CSS.escape(subId)}"] .subtask-edit-input`);
        if (inputEl) { inputEl.focus(); inputEl.select(); }
      }
      return;
    }

    const delSubBtn = e.target.closest(".subtask-delete");
    if (delSubBtn) {
      const subItem = e.target.closest(".subtask-item");
      if (!subItem) return;
      updateTask(taskId, t => {
        t.subtasks = t.subtasks.filter(s => s.id !== subItem.dataset.subtaskId);
      });
      if (editingSubtask && editingSubtask.taskId === taskId && editingSubtask.subtaskId === subItem.dataset.subtaskId) {
        editingSubtask = null;
      }
      return;
    }
  });

  list.addEventListener("submit", (e) => {
    const taskEditForm = e.target.closest(".task-edit-form");
    if (taskEditForm) {
      e.preventDefault();
      const taskItem = e.target.closest(".task-item");
      if (!taskItem) return;
      const taskId = taskItem.dataset.id;
      const textEl = taskEditForm.querySelector(".edit-text");
      const dueEl = taskEditForm.querySelector(".edit-due");
      const newText = (textEl.value || "").trim().slice(0, 140);
      if (!newText) return;
      const newDue = dueEl.value && parseDateKey(dueEl.value) ? dueEl.value : null;
      updateTask(taskId, t => { t.text = newText; t.dueDate = newDue; });
      editingTaskId = null;
      render();
      return;
    }

    const subtaskForm = e.target.closest(".subtask-form");
    if (subtaskForm) {
      e.preventDefault();
      const taskId = subtaskForm.dataset.taskId;
      const inputEl = subtaskForm.querySelector(".subtask-input");
      const text = (inputEl.value || "").trim().slice(0, 100);
      if (!text) return;
      updateTask(taskId, t => {
        t.subtasks.push({ id: uid(), text, completed: false });
      });
      // focus new subtask input again after render
      setTimeout(() => {
        const el = list.querySelector(`.task-item[data-id="${CSS.escape(taskId)}"] .subtask-input`);
        if (el) el.focus();
      }, 0);
    }
  });

  // Save subtask edit on Enter inside subtask edit input
  list.addEventListener("keydown", (e) => {
    const inputEl = e.target.closest(".subtask-edit-input");
    if (!inputEl) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const subItem = inputEl.closest(".subtask-item");
      const taskItem = inputEl.closest(".task-item");
      if (!subItem || !taskItem) return;
      const saveBtn = subItem.querySelector(".subtask-edit");
      if (saveBtn) saveBtn.click();
    } else if (e.key === "Escape") {
      editingSubtask = null;
      render();
    }
  });

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  advButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.adv;
      if (!(key in advancedFilters)) return;
      advancedFilters[key] = !advancedFilters[key];
      render();
    });
  });

  clearFiltersBtn.addEventListener("click", () => {
    searchQuery = "";
    searchInput.value = "";
    currentFilter = "all";
    selectedDate = null;
    advancedFilters = { overdue: false, today: false, hasSubtasks: false, noDueDate: false };
    render();
  });

  clearCompletedBtn.addEventListener("click", () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) return;
    const ok = window.confirm(`Purge ${completedCount} completed directive(s)?`);
    if (!ok) return;
    const snapshot = tasks.map(t => ({ ...t, subtasks: t.subtasks.map(s => ({ ...s })) }));
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
    showToast(`Purged ${completedCount} completed`, () => {
      tasks = snapshot;
      saveTasks();
      render();
    });
  });

  calPrevBtn.addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
  calNextBtn.addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
  calTodayBtn.addEventListener("click", () => { calendarCursor = startOfMonth(new Date()); renderCalendar(); });
  calGridEl.addEventListener("click", (e) => {
    const dayBtn = e.target.closest(".cal-day");
    if (!dayBtn) return;
    const key = dayBtn.dataset.date;
    if (!key) return;
    selectedDate = selectedDate === key ? null : key;
    const d = parseDateKey(key);
    if (d) calendarCursor = startOfMonth(d);
    render();
  });
  clearDateFilterBtn.addEventListener("click", () => { selectedDate = null; render(); });

  render();
})();
