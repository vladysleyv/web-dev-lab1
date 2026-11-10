class WorkoutEntry {
  constructor({ id = null, date, title, duration, exercises, notes = "" }) {
    this.id = id || crypto.randomUUID();
    this.date = date; // Формат РРРР-ММ-ДД
    this.title = title.trim();
    this.duration = Number(duration); // Тривалість у хвилинах
    // Масив об'єктів: { name, sets, reps, weight }
    this.exercises = exercises.map((ex) => ({
      name: ex.name.trim(),
      sets: Number(ex.sets),
      reps: Number(ex.reps),
      weight: Number(ex.weight)
    }));
    this.notes = notes.trim();
    this.createdAt = new Date().toISOString();
  }

  // Розрахунок загального тоннажу за тренування (підходи * повторення * вага)
  getTotalVolume() {
    return this.exercises.reduce((acc, ex) => acc + ex.sets * ex.reps * ex.weight, 0);
  }

  // Загальна кількість робочих підходів у тренуванні
  getTotalSets() {
    return this.exercises.reduce((acc, ex) => acc + ex.sets, 0);
  }
}

// 2. КЛАС-МЕНЕДЖЕР КОЛЕКЦІЇ: Управління щоденником тренувань
class WorkoutDiary {
  constructor(storageKey = "fitdiary_workouts_v15") {
    this.storageKey = storageKey;
    this.goalKey = "fitdiary_weekly_goal_v15";
    this.entries = [];
    this.weeklyGoal = 3;
    this.loadFromStorage();
  }

  // Додавання запису
  addEntry(entryData) {
    const newEntry = new WorkoutEntry(entryData);
    this.entries.push(newEntry);
    this.saveToStorage();
    return newEntry;
  }

  // Редагування запису за ID
  updateEntry(id, updatedData) {
    const index = this.entries.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.entries[index] = new WorkoutEntry({ ...updatedData, id });
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Видалення запису за ID
  removeEntry(id) {
    this.entries = this.entries.filter((item) => item.id !== id);
    this.saveToStorage();
  }

  // Отримання запису за ID
  getById(id) {
    return this.entries.find((item) => item.id === id) || null;
  }

  // Отримання унікального списку всіх видів вправ для випадаючого списку фільтрації
  getUniqueExercises() {
    const set = new Set();
    this.entries.forEach((entry) => {
      entry.exercises.forEach((ex) => set.add(ex.name));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "uk"));
  }

  // Пошук, фільтрація та сортування колекції
  getFilteredEntries({ searchQuery = "", exerciseName = "all", dateFrom = "", dateTo = "", sortBy = "date-desc" }) {
    let result = [...this.entries];

    // 1. Пошук за допомогою RegExp (за назвою тренування або назвою вправи)
    if (searchQuery.trim() !== "") {
      const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "i");
      result = result.filter(
        (entry) =>
          pattern.test(entry.title) ||
          entry.exercises.some((ex) => pattern.test(ex.name)) ||
          pattern.test(entry.notes)
      );
    }

    // 2. Фільтр за видом вправи
    if (exerciseName !== "all") {
      result = result.filter((entry) =>
        entry.exercises.some((ex) => ex.name.toLowerCase() === exerciseName.toLowerCase())
      );
    }

    // 3. Фільтр за початковою датою
    if (dateFrom) {
      result = result.filter((entry) => entry.date >= dateFrom);
    }

    // 4. Фільтр за кінцевою датою
    if (dateTo) {
      result = result.filter((entry) => entry.date <= dateTo);
    }

    // 5. Сортування
    result.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return a.date.localeCompare(b.date);
        case "duration-desc":
          return b.duration - a.duration;
        case "volume-desc":
          return b.getTotalVolume() - a.getTotalVolume();
        case "date-desc":
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return result;
  }

  // Підрахунок статистики для відфільтрованого списку
  calculateStats(entriesList) {
    return entriesList.reduce(
      (acc, entry) => {
        acc.totalWorkouts += 1;
        acc.totalDuration += entry.duration;
        acc.totalSets += entry.getTotalSets();
        acc.totalVolume += entry.getTotalVolume();
        return acc;
      },
      { totalWorkouts: 0, totalDuration: 0, totalSets: 0, totalVolume: 0 }
    );
  }

  // Підрахунок кількості тренувань за останні 7 днів для тижневої цілі
  getLast7DaysCount() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const minDateStr = sevenDaysAgo.toISOString().split("T")[0];
    const maxDateStr = today.toISOString().split("T")[0];

    return this.entries.filter((e) => e.date >= minDateStr && e.date <= maxDateStr).length;
  }

  setWeeklyGoal(goal) {
    const parsed = parseInt(goal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 14) {
      this.weeklyGoal = parsed;
      localStorage.setItem(this.goalKey, String(this.weeklyGoal));
    }
  }

  // Збереження в localStorage у форматі JSON
  saveToStorage() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
  }

  // Відновлення з localStorage або заповнення демонстраційними даними
  loadFromStorage() {
    const savedGoal = localStorage.getItem(this.goalKey);
    if (savedGoal) {
      this.weeklyGoal = parseInt(savedGoal, 10) || 3;
    }

    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.entries = parsed.map((obj) => new WorkoutEntry(obj));
        return;
      } catch (e) {
        console.error("Помилка читання localStorage:", e);
      }
    }

    // Початкові демо-записи, якщо localStorage порожній
    const today = new Date().toISOString().split("T")[0];
    this.entries = [
      new WorkoutEntry({
        date: today,
        title: "Силове: Груди та плечі",
        duration: 65,
        notes: "Відмінний тонус, робочі ваги збільшено на 2.5 кг.",
        exercises: [
          { name: "Жим штанги лежачи", sets: 4, reps: 8, weight: 75 },
          { name: "Армійський жим стоячи", sets: 3, reps: 10, weight: 42.5 },
          { name: "Віджимання на брусах", sets: 3, reps: 12, weight: 0 }
        ]
      }),
      new WorkoutEntry({
        date: "2026-10-28",
        title: "День ніг та кору",
        duration: 70,
        notes: "Інтенсивне тренування, акцент на техніку.",
        exercises: [
          { name: "Присідання зі штангою", sets: 4, reps: 8, weight: 90 },
          { name: "Румунська тяга", sets: 3, reps: 10, weight: 70 }
        ]
      })
    ];
    this.saveToStorage();
  }
}

// 3. ШАБЛОНИ РЕГУЛЯРНИХ ВИРАЗІВ ДЛЯ ВАЛІДАЦІЇ (RegExp)
const VALIDATION_PATTERNS = {
  // Дата у форматі РРРР-ММ-ДД (рік 2000-2099, місяць 01-12, день 01-31)
  date: /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  // Назва тренування або вправи: від 2 до 60 символів (літери, цифри, пробіли, дефіс, двокрапка, дужки)
  title: /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9\s\-:(),.]{2,60}$/,
  // Тривалість у хвилинах: ціле число від 1 до 600
  duration: /^([1-9]\d{0,1}|[1-5]\d{2}|600)$/,
  // Кількість підходів: ціле число від 1 до 30
  sets: /^([1-9]|[12]\d|30)$/,
  // Кількість повторень: ціле число від 1 до 200
  reps: /^([1-9]\d?|1\d{2}|200)$/,
  // Робоча вага (кг): 0 або додатне ціле/дробове число (до 999.99)
  weight: /^\d{1,3}([.,]\d{1,2})?$/
};

// 4. ІНІЦІАЛІЗАЦІЯ ТА DOM-ЕЛЕМЕНТИ
const diary = new WorkoutDiary();

const form = document.querySelector("#workout-form");
const formTitle = document.querySelector("#form-title");
const workoutIdInput = document.querySelector("#workout-id");
const dateInput = document.querySelector("#workout-date");
const durationInput = document.querySelector("#workout-duration");
const titleInput = document.querySelector("#workout-title");
const notesInput = document.querySelector("#workout-notes");
const exercisesContainer = document.querySelector("#exercises-container");
const addExerciseBtn = document.querySelector("#add-exercise-btn");
const submitBtn = document.querySelector("#submit-btn");
const cancelEditBtn = document.querySelector("#cancel-edit-btn");

// Елементи помилок
const errorDate = document.querySelector("#error-date");
const errorDuration = document.querySelector("#error-duration");
const errorTitle = document.querySelector("#error-title");
const errorExercises = document.querySelector("#error-exercises");

// Елементи фільтрів та списку
const searchInput = document.querySelector("#search-input");
const filterExerciseSelect = document.querySelector("#filter-exercise");
const filterDateFrom = document.querySelector("#filter-date-from");
const filterDateTo = document.querySelector("#filter-date-to");
const sortSelect = document.querySelector("#sort-select");
const resetFiltersBtn = document.querySelector("#reset-filters-btn");
const workoutListContainer = document.querySelector("#workout-list");

// Елементи статистики та тижневої цілі
const weeklyGoalInput = document.querySelector("#weekly-goal-input");
const goalStatusText = document.querySelector("#goal-status-text");
const goalProgressBar = document.querySelector("#goal-progress-bar");
const statTotalWorkouts = document.querySelector("#stat-total-workouts");
const statTotalDuration = document.querySelector("#stat-total-duration");
const statTotalSets = document.querySelector("#stat-total-sets");
const statTotalVolume = document.querySelector("#stat-total-volume");

// 5. ДИНАМІЧНЕ СТВОРЕННЯ РЯДКА ВПРАВИ У ФОРМІ ЗАСОБАМИ DOM
function createExerciseRow(data = { name: "", sets: "", reps: "", weight: "" }) {
  const row = document.createElement("div");
  row.className = "exercise-row";

  // Поле назви вправи
  const nameField = document.createElement("div");
  nameField.className = "exercise-field";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Назва вправи";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "ex-name";
  nameInput.placeholder = "Напр. Жим лежачи";
  nameInput.value = data.name;
  nameField.append(nameLabel, nameInput);

  // Поле підходів
  const setsField = document.createElement("div");
  setsField.className = "exercise-field";
  const setsLabel = document.createElement("label");
  setsLabel.textContent = "Підходи";
  const setsInput = document.createElement("input");
  setsInput.type = "text";
  setsInput.className = "ex-sets";
  setsInput.placeholder = "4";
  setsInput.value = data.sets;
  setsField.append(setsLabel, setsInput);

  // Поле повторень
  const repsField = document.createElement("div");
  repsField.className = "exercise-field";
  const repsLabel = document.createElement("label");
  repsLabel.textContent = "Повторення";
  const repsInput = document.createElement("input");
  repsInput.type = "text";
  repsInput.className = "ex-reps";
  repsInput.placeholder = "10";
  repsInput.value = data.reps;
  repsField.append(repsLabel, repsInput);

  // Поле ваги
  const weightField = document.createElement("div");
  weightField.className = "exercise-field";
  const weightLabel = document.createElement("label");
  weightLabel.textContent = "Вага (кг)";
  const weightInput = document.createElement("input");
  weightInput.type = "text";
  weightInput.className = "ex-weight";
  weightInput.placeholder = "60";
  weightInput.value = data.weight;
  weightField.append(weightLabel, weightInput);

  // Кнопка видалення вправи
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-danger-icon remove-exercise-btn";
  removeBtn.title = "Видалити вправу";
  removeBtn.textContent = "✕";

  row.append(nameField, setsField, repsField, weightField, removeBtn);
  exercisesContainer.append(row);
}

// 6. ВАЛІДАЦІЯ ФОРМИ ЗА ДОПОМОГОЮ РЕГУЛЯРНИХ ВИРАЗІВ
function clearValidationErrors() {
  [dateInput, durationInput, titleInput].forEach((el) => el.classList.remove("invalid"));
  errorDate.textContent = "";
  errorDuration.textContent = "";
  errorTitle.textContent = "";
  errorExercises.textContent = "";

  exercisesContainer.querySelectorAll("input").forEach((inp) => inp.classList.remove("invalid"));
}

function validateForm() {
  clearValidationErrors();
  let isValid = true;

  // Перевірка дати
  const dateVal = dateInput.value.trim();
  if (!VALIDATION_PATTERNS.date.test(dateVal)) {
    dateInput.classList.add("invalid");
    errorDate.textContent = "Формат РРРР-ММ-ДД (напр. 2026-10-31)";
    isValid = false;
  }

  // Перевірка тривалості
  const durationVal = durationInput.value.trim();
  if (!VALIDATION_PATTERNS.duration.test(durationVal)) {
    durationInput.classList.add("invalid");
    errorDuration.textContent = "Введіть ціле число від 1 до 600 хв";
    isValid = false;
  }

  // Перевірка назви тренування
  const titleVal = titleInput.value.trim();
  if (!VALIDATION_PATTERNS.title.test(titleVal)) {
    titleInput.classList.add("invalid");
    errorTitle.textContent = "Від 2 до 60 символів (літери, цифри, розділові знаки)";
    isValid = false;
  }

  // Перевірка динамічних рядків вправ
  const rows = exercisesContainer.querySelectorAll(".exercise-row");
  if (rows.length === 0) {
    errorExercises.textContent = "Додайте щонайменше одну вправу до тренування.";
    isValid = false;
  } else {
    rows.forEach((row) => {
      const nameInp = row.querySelector(".ex-name");
      const setsInp = row.querySelector(".ex-sets");
      const repsInp = row.querySelector(".ex-reps");
      const weightInp = row.querySelector(".ex-weight");

      if (!VALIDATION_PATTERNS.title.test(nameInp.value.trim())) {
        nameInp.classList.add("invalid");
        isValid = false;
      }
      if (!VALIDATION_PATTERNS.sets.test(setsInp.value.trim())) {
        setsInp.classList.add("invalid");
        isValid = false;
      }
      if (!VALIDATION_PATTERNS.reps.test(repsInp.value.trim())) {
        repsInp.classList.add("invalid");
        isValid = false;
      }
      if (!VALIDATION_PATTERNS.weight.test(weightInp.value.trim())) {
        weightInp.classList.add("invalid");
        isValid = false;
      }
    });

    if (!isValid && !errorExercises.textContent) {
      errorExercises.textContent =
        "Перевірте виділені поля вправ: назва (від 2 симв.), підходи (1-30), повторення (1-200), вага (0-999 кг).";
    }
  }

  return isValid;
}

// 7. РЕНДЕРИНГ СПИСКУ, ФІЛЬТРІВ ТА СТАТИСТИКИ ЗАСОБАМИ DOM
function updateExerciseFilterOptions() {
  const currentSelected = filterExerciseSelect.value;
  const exercises = diary.getUniqueExercises();

  filterExerciseSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Усі вправи";
  filterExerciseSelect.append(allOption);

  exercises.forEach((exName) => {
    const option = document.createElement("option");
    option.value = exName;
    option.textContent = exName;
    filterExerciseSelect.append(option);
  });

  if (exercises.includes(currentSelected)) {
    filterExerciseSelect.value = currentSelected;
  }
}

function renderStatsAndGoal(filteredEntries) {
  // Статистика за вибіркою
  const stats = diary.calculateStats(filteredEntries);
  statTotalWorkouts.textContent = stats.totalWorkouts;
  statTotalDuration.textContent = `${stats.totalDuration} хв`;
  statTotalSets.textContent = stats.totalSets;
  statTotalVolume.textContent = `${Math.round(stats.totalVolume)} кг`;

  // Прогрес-бар тижневої цілі
  const last7DaysCount = diary.getLast7DaysCount();
  const goal = diary.weeklyGoal;
  const percent = Math.min(100, Math.round((last7DaysCount / goal) * 100));

  weeklyGoalInput.value = goal;
  goalStatusText.textContent = `Виконано ${last7DaysCount} з ${goal} тренувань за останні 7 днів (${percent}%)`;
  goalProgressBar.style.width = `${percent}%`;

  if (percent >= 100) {
    goalProgressBar.classList.add("completed");
  } else {
    goalProgressBar.classList.remove("completed");
  }
}

function renderWorkoutList() {
  const filterParams = {
    searchQuery: searchInput.value,
    exerciseName: filterExerciseSelect.value,
    dateFrom: filterDateFrom.value,
    dateTo: filterDateTo.value,
    sortBy: sortSelect.value
  };

  const filtered = diary.getFilteredEntries(filterParams);
  renderStatsAndGoal(filtered);

  workoutListContainer.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state";
    emptyDiv.textContent = "Записів тренувань не знайдено. Додайте нове тренування або змініть параметри фільтрації.";
    workoutListContainer.append(emptyDiv);
    return;
  }

  filtered.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "workout-card";
    article.dataset.id = entry.id;

    // Верхня частина картки
    const header = document.createElement("div");
    header.className = "workout-card-header";

    const infoBlock = document.createElement("div");
    const titleEl = document.createElement("h3");
    titleEl.textContent = entry.title;

    const metaEl = document.createElement("div");
    metaEl.className = "workout-meta";

    const dateSpan = document.createElement("span");
    dateSpan.textContent = `📅 ${entry.date}`;

    const durationBadge = document.createElement("span");
    durationBadge.className = "badge";
    durationBadge.textContent = `⏱ ${entry.duration} хв`;

    const volumeBadge = document.createElement("span");
    volumeBadge.className = "badge";
    volumeBadge.textContent = `🏋️ Тоннаж: ${Math.round(entry.getTotalVolume())} кг`;

    metaEl.append(dateSpan, durationBadge, volumeBadge);
    infoBlock.append(titleEl, metaEl);

    // Кнопки дій
    const actionsBlock = document.createElement("div");
    actionsBlock.className = "card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-edit edit-workout-btn";
    editBtn.textContent = "Редагувати";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-delete delete-workout-btn";
    deleteBtn.textContent = "Видалити";

    actionsBlock.append(editBtn, deleteBtn);
    header.append(infoBlock, actionsBlock);

    // Таблиця вправ
    const table = document.createElement("table");
    table.className = "workout-exercises-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Вправа", "Підходи", "Повторення", "Вага (кг)", "Обсяг"].forEach((colText) => {
      const th = document.createElement("th");
      th.textContent = colText;
      headRow.append(th);
    });
    thead.append(headRow);

    const tbody = document.createElement("tbody");
    entry.exercises.forEach((ex) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = ex.name;

      const tdSets = document.createElement("td");
      tdSets.textContent = ex.sets;

      const tdReps = document.createElement("td");
      tdReps.textContent = ex.reps;

      const tdWeight = document.createElement("td");
      tdWeight.textContent = ex.weight === 0 ? "Власна вага" : `${ex.weight} кг`;

      const tdVol = document.createElement("td");
      tdVol.textContent = `${Math.round(ex.sets * ex.reps * ex.weight)} кг`;

      tr.append(tdName, tdSets, tdReps, tdWeight, tdVol);
      tbody.append(tr);
    });

    table.append(thead, tbody);
    article.append(header, table);

    // Коментар, якщо є
    if (entry.notes) {
      const notesP = document.createElement("p");
      notesP.className = "workout-notes-text";
      notesP.textContent = `💬 ${entry.notes}`;
      article.append(notesP);
    }

    workoutListContainer.append(article);
  });
}

// Скидання форми у початковий стан
function resetFormToDefault() {
  form.reset();
  workoutIdInput.value = "";
  dateInput.value = new Date().toISOString().split("T")[0];
  formTitle.textContent = "Додати нове тренування";
  submitBtn.textContent = "Зберегти тренування";
  cancelEditBtn.classList.add("hidden");
  clearValidationErrors();

  exercisesContainer.innerHTML = "";
  createExerciseRow();
}

// Завантаження даних тренування у форму для редагування
function startEditingWorkout(id) {
  const entry = diary.getById(id);
  if (!entry) return;

  clearValidationErrors();
  workoutIdInput.value = entry.id;
  dateInput.value = entry.date;
  durationInput.value = entry.duration;
  titleInput.value = entry.title;
  notesInput.value = entry.notes;

  exercisesContainer.innerHTML = "";
  entry.exercises.forEach((ex) => createExerciseRow(ex));

  formTitle.textContent = "✏️ Редагування тренування";
  submitBtn.textContent = "Оновити запис";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 8. ОБРОБНИКИ ПОДІЙ ТА ДЕЛЕГУВАННЯ

// Подія 1 (click): Додавання нового блоку вправи
addExerciseBtn.addEventListener("click", () => {
  createExerciseRow();
});

// Делегування подій (click) для видалення рядка вправи у формі
exercisesContainer.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-exercise-btn");
  if (!removeBtn) return;

  const row = removeBtn.closest(".exercise-row");
  if (row) {
    row.remove();
  }
});

// Подія 2 (submit): Надсилання форми додавання / редагування
form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateForm()) return;

  const exercisesData = Array.from(exercisesContainer.querySelectorAll(".exercise-row")).map((row) => ({
    name: row.querySelector(".ex-name").value,
    sets: row.querySelector(".ex-sets").value,
    reps: row.querySelector(".ex-reps").value,
    weight: row.querySelector(".ex-weight").value.replace(",", ".")
  }));

  const payload = {
    date: dateInput.value.trim(),
    duration: durationInput.value.trim(),
    title: titleInput.value.trim(),
    notes: notesInput.value.trim(),
    exercises: exercisesData
  };

  const editingId = workoutIdInput.value;
  if (editingId) {
    diary.updateEntry(editingId, payload);
  } else {
    diary.addEntry(payload);
  }

  updateExerciseFilterOptions();
  renderWorkoutList();
  resetFormToDefault();
});

// Скасування режиму редагування
cancelEditBtn.addEventListener("click", () => {
  resetFormToDefault();
});

// Делегування подій (click) на контейнері списку тренувань (редагування та видалення)
workoutListContainer.addEventListener("click", (event) => {
  const card = event.target.closest(".workout-card");
  if (!card) return;
  const id = card.dataset.id;

  if (event.target.closest(".delete-workout-btn")) {
    diary.removeEntry(id);
    if (workoutIdInput.value === id) {
      resetFormToDefault();
    }
    updateExerciseFilterOptions();
    renderWorkoutList();
  } else if (event.target.closest(".edit-workout-btn")) {
    startEditingWorkout(id);
  }
});

// Подія 3 (input): Пошук у реальному часі та зняття класу помилки при введенні
searchInput.addEventListener("input", () => {
  renderWorkoutList();
});

form.addEventListener("input", (event) => {
  if (event.target.classList.contains("invalid")) {
    event.target.classList.remove("invalid");
  }
});

// Подія 4 (change): Фільтрація за вправою, датами, сортування та зміна тижневої цілі
[filterExerciseSelect, filterDateFrom, filterDateTo, sortSelect].forEach((control) => {
  control.addEventListener("change", () => {
    renderWorkoutList();
  });
});

weeklyGoalInput.addEventListener("change", (event) => {
  diary.setWeeklyGoal(event.target.value);
  renderWorkoutList();
});

// Скидання фільтрів
resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterExerciseSelect.value = "all";
  filterDateFrom.value = "";
  filterDateTo.value = "";
  sortSelect.value = "date-desc";
  renderWorkoutList();
});

// 9. СТАРТ ЗАСТОСУНКУ ПІСЛЯ ЗАВАНТАЖЕННЯ DOM
document.addEventListener("DOMContentLoaded", () => {
  resetFormToDefault();
  updateExerciseFilterOptions();
  renderWorkoutList();
});