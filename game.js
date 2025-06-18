// Инициализация Matter.js
const Engine = Matter.Engine,
  Render = Matter.Render,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Body = Matter.Body,
  Events = Matter.Events,
  Composite = Matter.Composite,
  Query = Matter.Query;

// Создание движка
const engine = Engine.create({
  positionIterations: 20,
  velocityIterations: 20,
  constraintIterations: 20,
});
engine.gravity.y = 0.3;

const pieceMaterial = {
  friction: 0.3,
  restitution: 0.1,
  frictionStatic: 0.1,
  frictionAir: 0.02,
  slop: 0.05,
  chamfer: { radius: 5 },
};

// Получаем элементы DOM
const gameWrapper = document.getElementById("game-wrapper");
const gameContainer = document.getElementById("game-container");
const gameOverDisplay = document.getElementById("game-over");
const restartBtn = document.getElementById("restart-btn");
const pauseBtn = document.getElementById("pause-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const closeSettings = document.querySelector(".close-settings");
const musicToggle = document.getElementById("music-toggle");
const soundEffects = document.getElementById("sound-effects");
const colorsCount = document.getElementById("colors-count");
const pieceSize = document.getElementById("piece-size");
const bgMusic = document.getElementById("bg-music");
const collisionSound = document.getElementById("collision-sound");
const explosionSound = document.getElementById("explosion-sound");

// Настройка громкости звуков
bgMusic.volume = 0.02;
collisionSound.volume = 0.2;
explosionSound.volume = 0.3;

// Размеры игрового поля
const gameWidth = gameWrapper.clientWidth;
const gameHeight = gameWrapper.clientHeight;

// Настройка рендерера
const render = Render.create({
  element: gameContainer,
  engine: engine,
  options: {
    width: gameWidth,
    height: gameHeight,
    wireframes: false,
    background: "#19153A",
    showAngleIndicator: false,
    showCollisions: false,
    showVelocity: false,
    // Добавьте эти настройки:
    pixelRatio: window.devicePixelRatio || 1,
    enableSleeping: true,
    styles: {
      // Глобальные стили для всех фигур
      body: {
        strokeStyle: "#FFFFFF",
        lineWidth: 1,
        fillStyle: "transparent",
        glow: {
          color: "#FFFFFF",
          blur: 15,
        },
      },
    },
  },
});

// Пост-обработка для усиления неона
Events.on(render, "afterRender", function () {
  var ctx = render.context;
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "rgba(255,255,255,0.8)";
  ctx.shadowBlur = 15;
});

// Игровые переменные
const pieces = [];
const allColors = [
  "#ED1C24",
  "#22B14C",
  "#3F48CC",
  "#FFF200",
  "#FF7F27",
  "#B5E61D",
  "#FF00FF",
  "#00FFFF",
  "#9900FF",
  "#00FF99",
];
const shapes = [
  "circle",
  "square",
  "rectangle",
  "triangle",
  "pentagon",
  "hexagon",
  "trapezoid",
  "rhombus",
];
let colors = [];
let score = 0;
let displayedScore = 0;
let gameActive = true;
let gamePaused = false;
let touchStartX = 0;
let touchStartY = 0;
let currentPiece = null;
let canSpawnNewPiece = true;
let scoreAnimationFrame;
let pieceInterval;
let checkLinesInterval;
let baseArea = 3500; // Базовый размер фигур
let pausedVelocities = new WeakMap();

// Инициализация цветов
function initColors() {
  const count = parseInt(colorsCount.value);
  colors = allColors.slice(0, count);
}

// Инициализация размера фигур
function initPieceSize() {
  const size = pieceSize.value;
  if (size === "small") {
    baseArea = 2500;
  } else if (size === "medium") {
    baseArea = 3500;
  } else if (size === "large") {
    baseArea = 4500;
  } else if (size === "xlarge") {
    baseArea = 6000;
  }
}

// Создание границ
const ground = Bodies.rectangle(
  gameWidth / 2,
  gameHeight + 50,
  gameWidth,
  100,
  { isStatic: true, render: { fillStyle: "#FF00FF" }, friction: 0.1 }
);

const leftWall = Bodies.rectangle(-50, gameHeight / 2, 100, gameHeight, {
  isStatic: true,
  render: { visible: false },
  friction: 0,
  frictionStatic: 0,
  frictionAir: 0,
});

const rightWall = Bodies.rectangle(
  gameWidth + 50,
  gameHeight / 2,
  100,
  gameHeight,
  {
    isStatic: true,
    render: { visible: false },
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0,
  }
);

// Линия завершения игры (20% от верха)
const gameOverLine = Bodies.rectangle(
  gameWidth / 2,
  gameHeight * 0.2,
  gameWidth,
  2,
  {
    isStatic: true,
    isSensor: true,
    render: { visible: false },
  }
);

World.add(engine.world, [ground, leftWall, rightWall, gameOverLine]);

// Функция для создания неонового эффекта
function createNeonStyle(color) {
  return {
    fillStyle: color,
    strokeStyle: color,
    lineWidth: 4, // Толщина обводки
    shadowColor: color,
    shadowBlur: 20, // Размер свечения
    shadowOffset: { x: 0, y: 0 },
    // Дополнительные эффекты для неона
    glow: {
      color: color,
      blur: 30,
      offsetX: 0,
      offsetY: 0,
    },
    // Настройки для разных типов фигур
    wireframes: false,
    fill: true,
    stroke: true,
  };
}

// Анимация счета (медленное накручивание)
function animateScore() {
  if (Math.abs(displayedScore - score) < 1) {
    displayedScore = score;
    cancelAnimationFrame(scoreAnimationFrame);
  } else {
    displayedScore += (score - displayedScore) * 0.1;
    scoreAnimationFrame = requestAnimationFrame(animateScore);
  }
  document.getElementById("score").textContent = `SCORE: ${Math.floor(
    displayedScore
  )}`;
}

// Создание эффекта взрыва
function createExplosion(x, y, color) {
  const explosion = document.createElement("div");
  explosion.className = "explosion";
  explosion.style.left = `${x - 50}px`;
  explosion.style.top = `${y - 50}px`;
  explosion.style.boxShadow = `0 0 30px ${color}`;
  gameContainer.appendChild(explosion);

  setTimeout(() => {
    explosion.remove();
  }, 500);
}

// Создание всплывающего текста
function createScorePopup(x, y, points, color) {
  const popup = document.createElement("div");
  popup.className = "score-popup";
  popup.textContent = `+${points}`;
  popup.style.color = color;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  gameContainer.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1000);
}

// Создание фигур с одинаковой площадью
function createPiece() {
  if (!gameActive || !canSpawnNewPiece || gamePaused) return;

  canSpawnNewPiece = false;
  const x = gameWidth / 2;
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];

  let piece;
  const targetArea = baseArea;

  // Точный расчет размеров для одинаковой площади
  if (shape === "circle") {
    const radius = Math.sqrt(targetArea / Math.PI);
    piece = Bodies.circle(x, 50, radius, {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  } else if (shape === "square") {
    const side = Math.sqrt(targetArea);
    piece = Bodies.rectangle(x, 50, side, side, {
      ...pieceMaterial,
      render: createNeonStyle(color),
      chamfer: { radius: 5 },
    });
  } else if (shape === "rectangle") {
    const width = Math.sqrt(targetArea) * 2;
    const height = targetArea / width;
    piece = Bodies.rectangle(x, 50, width, height, {
      ...pieceMaterial,
      render: createNeonStyle(color),
      chamfer: { radius: 5 },
    });
  } else if (shape === "triangle") {
    const side = Math.sqrt((4 * targetArea * 0.8) / Math.sqrt(3));
    piece = Bodies.polygon(x, 50, 3, side / (2 * Math.sin(Math.PI / 3)), {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  } else if (shape === "pentagon") {
    const side = Math.sqrt((4 * targetArea * Math.tan(Math.PI / 5)) / 5);
    piece = Bodies.polygon(x, 50, 5, side / (2 * Math.sin(Math.PI / 5)), {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  } else if (shape === "hexagon") {
    const side = Math.sqrt((2 * targetArea) / (3 * Math.sqrt(3)));
    piece = Bodies.polygon(x, 50, 6, side, {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  } else if (shape === "trapezoid") {
    const width = Math.sqrt(targetArea * 1.2);
    const height = targetArea / width;
    const vertices = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 3, y: height / 2 },
      { x: -width / 3, y: height / 2 },
    ];
    piece = Bodies.fromVertices(x, 50, [vertices], {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  } else if (shape === "rhombus") {
    const width = Math.sqrt(targetArea * 3);
    const height = targetArea / width;
    const vertices = [
      { x: 0, y: -height / 2 },
      { x: width / 2, y: 0 },
      { x: 0, y: height / 2 },
      { x: -width / 2, y: 0 },
    ];
    piece = Bodies.fromVertices(x, 50, [vertices], {
      ...pieceMaterial,
      render: createNeonStyle(color),
    });
  }

  // Добавляем цвет к объекту фигуры для проверки
  piece.color = color;
  piece.shapeType = shape;

  World.add(engine.world, piece);
  pieces.push(piece);
  currentPiece = piece;

  // Добавляем очки за размещение фигуры
  const placementScore = Math.floor(3 + Math.random() * 5);
  addScore(placementScore, color, x, 50);
}

// Добавление очков с анимацией
function addScore(points, color, x, y) {
  score += points;
  createScorePopup(x, y, points, color);
  animateScore();
}

// Проверка заполненных линий

// Проверка заполненных линий
function checkLines() {
  if (!gameActive) return;

  // Группируем фигуры по цветам
  const colorGroups = {};

  // Собираем все фигуры одного цвета
  pieces.forEach((piece) => {
    if (!colorGroups[piece.color]) {
      colorGroups[piece.color] = [];
    }
    colorGroups[piece.color].push(piece);
  });

  // Проверяем каждую группу цветов
  for (const color in colorGroups) {
    const piecesOfColor = colorGroups[color];
    const clusters = [];

    // Находим кластеры близких фигур
    for (let i = 0; i < piecesOfColor.length; i++) {
      const piece = piecesOfColor[i];
      let addedToCluster = false;

      // Проверяем все существующие кластеры
      for (let j = 0; j < clusters.length; j++) {
        const cluster = clusters[j];

        // Проверяем расстояние до каждой фигуры в кластере
        for (let k = 0; k < cluster.length; k++) {
          const clusterPiece = cluster[k];
          const distance = getDistance(piece, clusterPiece);

          // Если расстояние меньше порогового - добавляем в кластер
          if (distance < 50) {
            // Уменьшили пороговое расстояние
            cluster.push(piece);
            addedToCluster = true;
            break;
          }
        }
        if (addedToCluster) break;
      }

      // Если не добавили ни в один кластер - создаем новый
      if (!addedToCluster) {
        clusters.push([piece]);
      }
    }

    // Проверяем кластеры на размер
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];

      // Если в кластере 5 и более фигур - удаляем
      if (cluster.length >= 5) {
        cluster.forEach((piece) => {
          World.remove(engine.world, piece);
          const index = pieces.indexOf(piece);
          if (index > -1) pieces.splice(index, 1);
        });

        if (soundEffects.value === "on") {
          explosionSound.currentTime = 0;
          explosionSound.play();
        }

        score += cluster.length * 10;
        document.getElementById("score").textContent = `SCORE: ${score}`;
        canSpawnNewPiece = true;

        // Добавляем очки за уничтожение кластера
        const clusterScore = Math.floor(75 + Math.random() * 51); // 75-125 очков
        const centerX =
          cluster.reduce((sum, piece) => sum + piece.position.x, 0) /
          cluster.length;
        const centerY =
          cluster.reduce((sum, piece) => sum + piece.position.y, 0) /
          cluster.length;
        addScore(clusterScore, color, centerX, centerY);

        canSpawnNewPiece = true;
      }
    }
  }
}

// Вспомогательная функция для расчета расстояния между фигурами
function getDistance(pieceA, pieceB) {
  // Для кругов используем радиус
  if (pieceA.circleRadius && pieceB.circleRadius) {
    const dx = pieceA.position.x - pieceB.position.x;
    const dy = pieceA.position.y - pieceB.position.y;
    return (
      Math.sqrt(dx * dx + dy * dy) - pieceA.circleRadius - pieceB.circleRadius
    );
  }

  // Для других фигур используем примерный размер
  const sizeA = pieceA.width || pieceA.circleRadius || 40;
  const sizeB = pieceB.width || pieceB.circleRadius || 40;
  const dx = pieceA.position.x - pieceB.position.x;
  const dy = pieceA.position.y - pieceB.position.y;
  return Math.sqrt(dx * dx + dy * dy) - sizeA / 2 - sizeB / 2;
}

// Проверка завершения игры
function checkGameOver() {
  pieces.forEach((piece) => {
    if (piece.position.y < gameHeight * 0.2) {
      endGame();
    }
  });
}

// Проверка завершения игры
function checkGameOver() {
  pieces.forEach((piece) => {
    if (piece.position.y < gameHeight * 0.2) {
      endGame();
    }
  });
}

// Завершение игры
function endGame() {
  gameActive = false;
  gameOverDisplay.style.display = "block";
  restartBtn.style.display = "block";
  clearInterval(pieceInterval);
  clearInterval(checkLinesInterval);
}

// Перезапуск игры
function restartGame() {
  // Удаляем все фигуры
  Composite.clear(engine.world, false);
  pieces.length = 0;

  // Восстанавливаем границы
  World.add(engine.world, [ground, leftWall, rightWall, gameOverLine]);

  // Сбрасываем счет
  score = 0;
  displayedScore = 0;
  document.getElementById("score").textContent = `SCORE: ${score}`;

  // Скрываем сообщения
  gameOverDisplay.style.display = "none";
  restartBtn.style.display = "none";

  // Запускаем игру
  gameActive = true;
  gamePaused = false;
  currentPiece = null;
  canSpawnNewPiece = true;
  pausedVelocities = new WeakMap();

  // Обновляем настройки
  initColors();
  initPieceSize();

  // Перезапускаем интервалы
  clearInterval(pieceInterval);
  clearInterval(checkLinesInterval);
  pieceInterval = setInterval(() => {
    if (canSpawnNewPiece) {
      createPiece();
    }
  }, 1000);
  checkLinesInterval = setInterval(checkLines, 100);
}

// Пауза игры
function togglePause() {
  gamePaused = !gamePaused;
  pauseBtn.textContent = gamePaused ? "▶" : "⏸";

  if (gamePaused) {
    // Сохраняем текущие скорости всех фигур
    Matter.Composite.allBodies(engine.world).forEach((body) => {
      if (!body.isStatic) {
        pausedVelocities.set(body, {
          velocity: { ...body.velocity },
          angularVelocity: body.angularVelocity,
        });
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
      }
    });
    Matter.Engine.clear(engine);
  } else {
    // Восстанавливаем скорости всех фигур
    Matter.Composite.allBodies(engine.world).forEach((body) => {
      if (!body.isStatic && pausedVelocities.has(body)) {
        const velocities = pausedVelocities.get(body);
        Body.setVelocity(body, velocities.velocity);
        Body.setAngularVelocity(body, velocities.angularVelocity);
        pausedVelocities.delete(body);
      }
    });
    Matter.Engine.run(engine);
  }
}

// Управление с клавиатуры
document.addEventListener("keydown", (e) => {
  if (!gameActive || !currentPiece || gamePaused) return;

  if (e.key === "ArrowLeft") {
    Body.setVelocity(currentPiece, { x: -5, y: currentPiece.velocity.y });
  } else if (e.key === "ArrowRight") {
    Body.setVelocity(currentPiece, { x: 5, y: currentPiece.velocity.y });
  } else if (e.key === "ArrowUp") {
    Body.setAngularVelocity(currentPiece, 0.05);
  } else if (e.key === "ArrowDown") {
    Body.setAngularVelocity(currentPiece, -0.05);
  } else if (e.key === "p" || e.key === "P") {
    togglePause();
  }
});

// Управление касанием для мобильных устройств
gameContainer.addEventListener("touchstart", (e) => {
  if (!gameActive || !currentPiece || gamePaused) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  e.preventDefault();
});

gameContainer.addEventListener("touchmove", (e) => {
  if (!gameActive || !currentPiece || gamePaused) return;

  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;
  const diffX = touchX - touchStartX;
  const diffY = touchY - touchStartY;

  if (Math.abs(diffX) > Math.abs(diffY)) {
    // Горизонтальный свайп - движение влево/вправо
    Body.setVelocity(currentPiece, {
      x: diffX * 0.2,
      y: currentPiece.velocity.y,
    });
  } else {
    // Вертикальный свайп - вращение
    Body.setAngularVelocity(currentPiece, diffY * 0.002);
  }

  touchStartX = touchX;
  touchStartY = touchY;
  e.preventDefault();
});

// Обработчик столкновений
Events.on(engine, "collisionStart", (event) => {
  if (!gameActive || gamePaused) return;

  const pairs = event.pairs;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];

    // Если текущая фигура коснулась земли или другой фигуры
    if (
      (pair.bodyA === currentPiece || pair.bodyB === currentPiece) &&
      (pair.bodyA === ground ||
        pair.bodyB === ground ||
        (pieces.includes(pair.bodyA) && pieces.includes(pair.bodyB)))
    ) {
      // Воспроизводим звук столкновения
      if (soundEffects.value === "on") {
        collisionSound.currentTime = 0;
        collisionSound.play();
      }

      // Добавляем очки за столкновение
      const collisionScore = Math.floor(3 + Math.random() * 5);
      addScore(
        collisionScore,
        currentPiece.color,
        currentPiece.position.x,
        currentPiece.position.y
      );

      currentPiece = null;
      canSpawnNewPiece = true;
      checkLines();
      checkGameOver();
      break;
    }
  }
});

// Кнопка перезапуска
restartBtn.addEventListener("click", restartGame);

// Кнопка паузы
pauseBtn.addEventListener("click", togglePause);

// Кнопка настроек
settingsBtn.addEventListener("click", () => {
  settingsPanel.style.display = "block";
});

// Закрытие настроек
closeSettings.addEventListener("click", () => {
  settingsPanel.style.display = "none";
  initColors(); // Обновляем цвета при изменении настроек
  initPieceSize(); // Обновляем размер фигур
});

// Управление музыкой
musicToggle.addEventListener("change", () => {
  if (musicToggle.value === "on") {
    bgMusic.play();
  } else {
    bgMusic.pause();
  }
});

// Запуск игры
function startGame() {
  initColors();
  initPieceSize();

  if (musicToggle.value === "on") {
    bgMusic.play();
  }

  Engine.run(engine);
  Render.run(render);

  // Новая фигура каждые 1 секунду
  pieceInterval = setInterval(() => {
    if (canSpawnNewPiece) {
      createPiece();
    }
  }, 1000);

  // Проверка линий каждые 100 мс
  checkLinesInterval = setInterval(checkLines, 100);
}

// Обработчик изменения размера окна
window.addEventListener("resize", () => {
  render.options.width = gameWrapper.clientWidth;
  render.options.height = gameWrapper.clientHeight;
  Render.setPixelRatio(render, window.devicePixelRatio);
});

// Старт игры
startGame();
