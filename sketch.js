// ==========================================================
// 未完成的事 · 脑内星系
//
// setup() 初始化，draw() 每帧做两件事：更新位置、重新画一遍
//
// 视觉：深色深空背景 + 柔和的白字 + 每个任务一颗星体
//       （大小略有不同，外圈一层非常轻微的光晕），大量留白
//
// 运动：每个任务有一条看不见的椭圆轨道，绕主画布中心缓慢转圈。
//       位置由「相位」直接算出，所以一定在稳定地走，不会卡住、不会乱飞；
//       全体同向公转、半径与角速度各不相同，相位和半径上再叠一层很慢的
//       noise 抖动——所以看起来是「自然漂浮」，不是机械旋转
//
// 压力感：未完成的任务越多，脑内空间越挤——轨道整体向内收一点、
//       允许彼此靠得更近、光晕略强、公转略快、核心微光稍亮。
//       压力值只由未完成数量决定，而且变化极慢，所以点 LET GO 之后是缓缓松开。
//       数值永远不显示，效果也都很小，只是让「紧」被感觉到
//
// 呼吸感：压力高时，整个星系还会非常缓慢地「喘」——速度做极小的周期起伏、
//       光晕慢慢一明一暗，那种隐约的「不安静」就来自这里。
//       呼吸的幅度同样乘上 pressure：任务一件件做完，压力降下来，
//       呼吸也跟着变浅、最后完全停下来（空间重新变安静、变开阔）
//
// 任务重量：每件事都有自己的 weight，由它「已经在清单里待了多久」决定。
//       新任务轻：小一点、快一点、飘得高一些；
//       老任务沉：大一点、慢一点、整条轨道略微向下沉一点。
//       重量还会随会话极慢地累积——只要没做完，就一直变沉一点点。
//       没有任何数字、也没有「几天未完成」之类的文案，
//       只靠「变大 / 变慢 / 下沉」这三处视觉去传达「这件事越来越沉了」
//
// 交互：
//   1. 点击某个圆会选中它，这个圆改为绕画布中心转圈；点别的圆切换，点空白取消
//   2. 选中后点 LET GO（页面上那行很小的字）：这颗星体被「松开」——
//      停止原有运动，从当前位置加速往下掉，落进画布底部那片安静的空白里
//      （落地瞬间压扁一下再弹回来，啪），落地后彻底不动；
//      没选中星体时那行字是禁用的，淡到几乎看不见，点了没有任何反应
//
// 暂不处理：圆与圆的碰撞、已松开的星体重新回到轨道
// ==========================================================

const TITLE = "Things I haven't finished";

// 7 个任务
const TASKS = [
  "改简历",
  "整理房间",
  "学日语",
  "做播客",
  "拍视频",
  "做 App",
  "做项目",
];

// 字体：Segoe UI Light 很细，正好配「安静」；中文会往下回退到系统黑体
const FONT_LIGHT =
  "'Segoe UI Light', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const FONT_REGULAR =
  "'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif";

// ---------- 配色：深空 / 极简 ----------
const C = {
  // 背景：径向渐变，中心透一点微光，四周沉进黑里
  bgInner: "#1b1f27",
  // 压力高时核心会朝这个颜色靠一点点（只动中心、不动外围，
  // 所以四条边仍然落在同一个深色上，看不出画布边界）
  bgInnerHot: "#242b3a",
  bgOuter: "#08090c",

  title: "rgba(238, 241, 246, 0.94)", // 柔和的白，不用纯白
  titleRule: "rgba(255, 255, 255, 0.10)", // 标题下那条极淡的短线

  // 三种状态：off 普通、on 选中、done 已完成
  //   fill   星体本体的深色（比背景亮一点点，才有「球体」的感觉）
  //   stroke 边缘的微光
  //   glow   外面那层柔和光晕的 RGB（透明度单列成 glowA，压力要按比例调它）
  //   text   圆里的字
  bubbles: {
    off: {
      fill: "#232833",
      stroke: "rgba(208, 218, 238, 0.42)",
      glow: "150, 180, 255",
      glowA: 0.12,
      text: "rgba(228, 233, 242, 0.88)",
    },
    on: {
      fill: "#2c3340",
      stroke: "rgba(236, 243, 255, 0.90)",
      glow: "165, 195, 255",
      glowA: 0.3,
      text: "rgba(248, 250, 255, 0.98)",
    },
    done: {
      // 完成的任务往黑里退一点，安静地待着
      fill: "#171b23",
      stroke: "rgba(148, 180, 166, 0.38)",
      glow: "140, 200, 175",
      glowA: 0.08,
      text: "rgba(176, 198, 188, 0.70)",
    },
  },

  divider: "rgba(255, 255, 255, 0.07)",
  doneLabel: "rgba(255, 255, 255, 0.26)",
};

const RATIO = 360 / 640; // 画布宽高比 16:9

// 绕中心公转的速度：每帧转过的弧度，约 8 秒转一圈
// （比平时飘动的速度快，所以轨迹看得比较明显）
const ORBIT_SPEED = (Math.PI * 2) / (8 * 60);

// 画布底部的 DONE 区域：占画布高度的 24%
const STRIP_RATIO = 0.24;
// DONE 区域里每个圆变小：直径占画布宽度的 8.5%
const DONE_D_RATIO = 0.085;

// 下落动画：每帧给向下的速度加多少（按画布高度取比例）
// 数值越大掉得越干脆，越像「啪」地一下砸下来
const GRAVITY_RATIO = 0.001;
// 落地瞬间压扁的程度：横向变宽、纵向变矮
const SQUASH = 0.45;

// ---------- 轨道感 ----------
// 每个任务一条自己的（不画出来的）椭圆轨道，绕主画布中心缓慢转圈。
// 位置由「相位」直接算出来（运动学模型），而不是靠转向力慢慢逼近：
//   · 相位每帧稳定前进 → 一定在绕中心走，不会卡住、不会被挤离轨道
//   · 每条轨道半径不同、角速度略有差别 → 每颗星体的速度看起来都不一样
//   · 相位和半径上各叠一层缓慢的 noise 抖动 → 打破机械的椭圆感
const RING_MIN = 0.48; // 最内圈（归一化，1 = 最外圈）
const RING_MAX = 0.96; // 最外圈（留出呼吸放大的余量，保证不出界）
const BREATHE = 0.03; // 半径随 noise 缓慢呼吸的幅度（±3%，约几个像素）
const PHASE_WOBBLE = 0.08; // 相位随 noise 晃动的幅度（弧度）。
// 注意不能太大：扁平轨道上 0.1 弧度就是几十像素的位移，
// 抖动过大会让星体自己晃到一起（实测 ±0.18 时出现十几秒的重叠）
const NOISE_STEP = 0.0016; // noise 随时间推进的快慢：越小越慢越平滑

// ---------- 压力感 ----------
// 「未完成的事越多，脑内空间越挤」。
// pressure 只由未完成的任务数量决定（0 = 都做完了，1 = 一件都没做），
// 但它**变化得非常慢**：点 LET GO 之后是「缓缓松开」，而不是一下就散开。
// 所有效果都压得很小，目标是让人隐约觉得「紧了一点」，而不是看见一个提示
const PRESSURE_EASE = 0.006; // 压力值靠拢目标的速度，约 5 秒才走完大半
const P_SPEED = 0.18; // 满压力：公转最多快 18%
const P_SHRINK = 0.07; // 满压力：所有轨道半径向中心收 7%（整体更挤）
const P_PACK = 0.05; // 满压力：允许两颗星体靠得更近（安全间距 1.3 → 1.25）
const P_GLOW = 0.35; // 满压力：光晕最多亮 35%
const P_HAZE = 0.5; // 满压力：核心的微光最多朝 bgInnerHot 走一半

let pressure = 1; // 当前压力（平滑后的 0~1）。一开始 7 件全没做，直接就是满的
let pressureTarget = 1; // 未完成数量算出来的目标压力

// ---------- 呼吸感 ----------
// 压力不只是「挤」，还会让整个星系轻轻地「喘」：速度做极小的周期起伏、
// 光晕非常缓慢地一明一暗。所有幅度都乘 pressure，所以——
//   未完成的事多 → 呼吸明显，有一点「不安静」；
//   一件件做完 → 压力下降 → 呼吸自然变浅、直到停下来，空间重新安静、开阔。
// 呼吸值由两条不同周期的正弦叠加而成（不是单一节拍），因此不完全规律：
// 那种「隐约不太对劲」的感觉就来自这里。周期非常长，绝不会像闪烁
const BREATH_PERIOD = 13 * 60; // 主周期：约 13 秒一个来回（非常慢）
const BREATH_MIX = 0.62; // 主正弦占的比重，其余给第二条更慢的波（打破节拍感）
const P_BREATH_SPEED = 0.03; // 满压力：速度随呼吸最多 ±3%
const P_BREATH_GLOW = 0.14; // 满压力：光晕随呼吸最多 ±14%
const P_BREATH_HAZE = 0.22; // 满压力：核心微光随呼吸最多 ±22%

let breath = 0; // 全系统共用的呼吸值，-1 ~ 1（每帧平滑更新一次）

// 全体同向公转（像星系盘）：相邻轨道永远不会迎头相撞，只会缓慢超越。
// 角速度差故意收得很小：整个「星系盘」只是慢慢剪切，相对位置能长时间
// 保持，不会频繁出现互相追尾；速度的差异主要来自轨道半径的不同
const OMEGA0 = (Math.PI * 2) / (95 * 60); // 基准角速度：约 95 秒转一圈
function omegaFor(b) {
  // 里圈稍快、外圈稍慢（一点点开普勒味），再乘每颗自己的快慢系数；
  // 然后乘上压力系数（压力越高转得略快一点，满压力 +18%）、
  // 呼吸系数（压力高时速度做 ±3% 的极慢起伏），
  // 最后乘上重量系数——越沉的星体转得越慢（最多慢 15%），
  // 所以「老任务」看起来总像在吃力地挪动
  return (
    OMEGA0 *
    (1.06 - 0.12 * b.ringR) *
    b.speedJit *
    (1 + P_SPEED * pressure) *
    (1 + P_BREATH_SPEED * pressure * breath) *
    (1 - W_SLOW * b.weight)
  );
}

// ---------- 任务重量 ----------
// 「这件事拖得越久，就越沉」。
// 每个任务有一个 weight（0~1），由它已经在清单里待了多久决定；
// 所有效果都压得很小、变化也很慢，只是让人隐约觉得「它变沉了」。
//
// 说明：这个原型没有后端，所以「存在时间」来自下面这张固定的年龄表
//（越后面的数字越大 = 这件事被拖得越久）。它只是一个内部数值，
// 画面上永远不会出现任何数字或日期
const AGE_DAYS = [2, 5, 12, 3, 8, 21, 35]; // 与 TASKS 一一对应
const AGE_FULL = 35; // 到这个天数就算「最沉」（weight = 1）

const W_SIZE = 0.2; // 重量对大小的影响：最沉比最轻大 20%（平均大小不变）
const W_SLOW = 0.15; // 重量对速度的影响：最沉的比最轻的慢 15%
const W_DROP_RATIO = 0.035; // 重量对「下沉」的影响：最沉的整条轨道下移画布高的 3.5%

// 会话内的缓慢增重：只要还没做完，就一直变沉一点点。
// 极慢——约 1 分钟 +0.012，看一两分钟几乎察觉不到，但确实在增加；
// 封顶在 0.3，所以时间再长也不会把星体撑破队形
const WEIGHT_CREEP_PER_MIN = 0.012;
const WEIGHT_CREEP_MAX = 0.3;

// 由「已存在天数」算出基础重量。用 pow 让中段的差别也拉得开
//（线性的话，年轻的那几个会全部挤在接近 0 的地方，看不出层次）
function baseWeightOf(i) {
  const t = Math.min(1, AGE_DAYS[i] / AGE_FULL);
  return Math.pow(t, 0.55);
}

// 大小由重量决定：越沉越大（最沉比最轻大 W_SIZE）。
// 这里刻意不加任何随机抖动——大小必须**完全**跟着重量走，
// 否则「更大的那颗一定是更沉的」这条视觉线索就被打乱了。
// 系数围绕 1 分布，所以整组的平均大小和以前一样，不会更挤
function sizeFromWeight(w) {
  return 1 - W_SIZE / 2 + W_SIZE * w;
}

let canvas; // 保存 canvas 对象，后面调整尺寸要用
let bubbles = []; // 每个任务的状态
let selected = -1; // 当前选中的任务下标，-1 表示没有选中
let letGoBtn; // HTML 里的 LET GO 文字入口（不是按钮，见 style.css）
let stars = []; // 远处的星点（坐标存成 0~1 的比例，画布缩放时跟着走）

function setup() {
  // 1. 创建画布
  canvas = createCanvas(640, 360);

  // 2. 把 canvas 放进 HTML 里的 <div id="canvas-holder">
  canvas.parent("canvas-holder");

  // 3. 先让画布尺寸和容器一致，再按画布尺寸摆圆、给速度
  resizeToFit();
  makeStars();
  initBubbles();

  // 4. LET GO 文字入口：没选中星体时它是禁用的，
  //    所以「没选中就什么都不做」由浏览器保证，这里不用再判断
  letGoBtn = document.getElementById("letgo-btn");
  letGoBtn.addEventListener("click", letGo);
}

function draw() {
  updatePressure(); // 先按未完成数量更新压力（很慢地靠拢，绝不突变）
  updateBreath(); // 再推进一点点呼吸相位（很慢的正弦，天然连续）
  updateWeight(); // 每个任务的重量（基础重量 + 极慢的会话累积）

  drawBackdrop(); // 每帧重画背景（深空 + 星点），也就顺便清了屏
  drawTitle();
  drawDoneZone();

  // 鼠标悬在某个圆上时显示手型，提示它可点
  cursor(mouseInCanvas() && bubbleAt(mouseX, mouseY) !== -1 ? HAND : ARROW);
  syncLetGoButton();

  // 1. 先更新所有星体的位置和状态
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];

    if (b.done) {
      updateDone(b); // 已松开：往下沉进底部那片空白，不再有原来的运动
      b.state = "done";
    } else {
      updateBubble(b, i); // 没完成：缓慢地漂浮 / 被选中后公转
      b.state = i === selected ? "on" : "off";
    }
  }

  // 2. 星体之间轻轻让路，避免慢慢挤成一团
  separateBodies();

  // 2. 再分三层画：光晕 → 星体本体 → 文字
  //    这样后画星体的光晕不会糊到先画星体的文字上，文字始终干净清楚
  for (const b of bubbles) drawHalo(b);
  for (const b of bubbles) drawBody(b);
  for (const b of bubbles) drawLabel(b);
}

// ---------- 压力感 ----------

// 目标压力 = 未完成的任务占全部任务的比例。
// 真正的 pressure 每帧只朝目标走一小步（PRESSURE_EASE），
// 所以哪怕一次点掉三个任务，画面也是慢慢松开的，不会有任何突变
function updatePressure() {
  let unfinished = 0;
  for (const b of bubbles) {
    if (!b.done) unfinished++;
  }
  pressureTarget = unfinished / bubbles.length;
  pressure += (pressureTarget - pressure) * PRESSURE_EASE;
}

// 全系统的「呼吸」：两条正弦叠加 → -1 ~ 1。
// 直接用 frameCount 算，所以每一帧之间必然连续，不会跳变；
// 第二条波的周期和主周期不成整数比，所以呼吸不会精确地重复，
// 也就不会有「机械节拍」的感觉
function updateBreath() {
  const t = (frameCount / BREATH_PERIOD) * Math.PI * 2;
  const v =
    BREATH_MIX * Math.sin(t) + (1 - BREATH_MIX) * Math.sin(t * 0.618 + 1.7);
  breath = Math.max(-1, Math.min(1, v));
}

// ---------- 任务重量 ----------

// 每帧更新每个未完成任务的重量：基础重量（由年龄决定）+ 会话内的极慢累积。
// 累积按「分钟」推进，所以短时间看几乎不动，拖久了才会慢慢压下来。
// 重量一变，星体的大小跟着变（越沉越大）
function updateWeight() {
  const creep = Math.min(
    WEIGHT_CREEP_MAX,
    (frameCount / 3600) * WEIGHT_CREEP_PER_MIN
  );
  const baseD = width * 0.105;

  for (const b of bubbles) {
    if (b.done) continue; // 已完成的不再变沉（它已经落地了）
    b.weight = Math.min(1, b.baseWeight + creep);
    b.d = baseD * sizeFromWeight(b.weight);
  }
}

// 重量带来的「下沉」：越沉的星体，整条轨道越往下移一点点。
// 做成「轨道中心下移」而不是「给位置加个向下的偏移」，
// 这样它仍然是一条干净、连续、不会撞到边界的椭圆
function dropOffset(b) {
  return height * W_DROP_RATIO * b.weight;
}

// 两个颜色之间按比例混一下，返回 CSS 颜色串
function mixHex(a, b, t) {
  const ca = color(a);
  const cb = color(b);
  return `rgb(${Math.round(lerp(red(ca), red(cb), t))}, ${Math.round(
    lerp(green(ca), green(cb), t)
  )}, ${Math.round(lerp(blue(ca), blue(cb), t))})`;
}

// ---------- 背景 ----------

// 生成远处的星点。固定随机种子，所以每次打开都是同一片星空，不会乱跳
function makeStars() {
  randomSeed(7);
  stars = [];
  for (let i = 0; i < 46; i++) {
    stars.push({
      x: random(), // 0~1，绘制时再乘画布宽
      y: random() * 0.78, // 只在 DONE 区域以上铺，别落到「已完成」那边去
      r: random(0.4, 1.5), // 直径
      a: random(0.05, 0.16), // 很淡，只是远远的一点
    });
  }
}

function drawBackdrop() {
  const ctx = drawingContext;

  // 一块径向渐变铺满画布：中心微微亮（像星系的核），四周沉下去。
  // 渐变半径取「到最近那条边的距离」，这样四条边都落在最后一个颜色上，
  // 和页面背景（同一个深色）无缝衔接，看不出画布的边界
  const gx = width / 2;
  const gy = height * 0.42;
  const glowR = Math.min(width / 2, gy, height - gy);
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
  // 中心那点微光：压力越高，核心稍亮、稍冷一点点——
  // 空间像被压紧了，但只动中心颜色，四边仍然是同一个深色。
  // 它也跟着呼吸极轻微地一深一浅（幅度乘 pressure，压力低时就没有了）
  const haze = Math.min(
    1,
    Math.max(
      0,
      P_HAZE * pressure * (1 + P_BREATH_HAZE * pressure * breath)
    )
  );
  g.addColorStop(0, mixHex(C.bgInner, C.bgInnerHot, haze));
  g.addColorStop(1, C.bgOuter);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // 远处的小星点：负责「空」和一点孤独感
  noStroke();
  for (const s of stars) {
    fill(255, 255, 255, 255 * s.a);
    circle(s.x * width, s.y * height, s.r);
  }
}

// ---------- LET GO（松开一颗星体）----------
// 概念上这不是「打勾完成」，而是「放开它」：
// 星体离开原来的轨道，慢慢沉下去，落进底部那片安静的空白里。

// 点 LET GO：把当前选中的星体放下去
function letGo() {
  if (selected === -1) return; // 没有选中：什么都不做（正常也不会触发，按钮是禁用的）

  const b = bubbles[selected];
  b.done = true;
  b.slot = bubbles.filter((x) => x.done).length - 1; // 在落点区域里排第几个
  selected = -1; // 松开之后就不再是「选中」状态

  // 准备下落：记住起点，横向速度清掉，只给一点点向下的初速度
  b.landed = false;
  b.startX = b.x;
  b.startY = b.y;
  b.vx = 0;
  b.vy = height * 0.003;
}

// 没选中星体时禁用这个文字入口，避免点了没反应
function syncLetGoButton() {
  const shouldDisable = selected === -1;
  if (letGoBtn.disabled !== shouldDisable) {
    letGoBtn.disabled = shouldDisable;
  }
}

// ---------- 鼠标交互 ----------

// 鼠标现在是否在画布范围内
function mouseInCanvas() {
  return mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
}

function mousePressed() {
  // 注意：p5 的 mousePressed() 挂在 window 上，点击画布以外的元素
  //（比如下面那行 LET GO）时也会触发一次，而且鼠标坐标会被算成
  // 「相对画布」的位置，落在画布外面。
  // 不挡住这种情况的话，点 LET GO 的瞬间会先取消选中，
  // 接着 letGo() 发现 selected 是 -1 就直接返回，星体永远松不开。
  if (!mouseInCanvas()) return;

  const hit = bubbleAt(mouseX, mouseY);

  if (hit === -1) {
    selected = -1; // 点空白处：取消选中
    return;
  }

  if (hit !== selected) {
    selected = hit; // 切换选中，并让它从当前位置接上公转
    startOrbit(bubbles[hit]);
  }
}

// 鼠标底下的任务下标；没点中任何圆就返回 -1
// 从后往前找，和绘制顺序一致：后画的圆在上面，应该优先被选中
function bubbleAt(x, y) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (b.done) continue; // 已完成的不再响应点击
    if (dist(x, y, b.x, b.y) <= b.d / 2) return i;
  }
  return -1;
}

// 让某个圆开始绕主画布中心转圈
// 角度和半径都从它「当前的位置」算起，这样不会突然跳一下
function startOrbit(b) {
  b.orbiting = true; // 记住状态：取消选中时要从当前位置平滑接回自己的轨道
  const cy = stripTop() / 2 + dropOffset(b); // 公转中心的 y（同样带上下沉）
  b.orbitAngle = Math.atan2(b.y - cy, b.x - width / 2);
  b.orbitR = dist(b.x, b.y, width / 2, cy);
}

// ---------- 标题 ----------

function drawTitle() {
  noStroke();
  textFont(FONT_LIGHT);
  textAlign(CENTER, CENTER);

  // 主标题：柔和的白、很轻的字重，上下都留大片空白
  textSize(width * 0.052);
  fill(C.title);
  text(TITLE, width / 2, height * 0.15);

  // 标题下一条极淡的短线：给画面一个安静的落脚点
  stroke(C.titleRule);
  strokeWeight(1);
  const lw = width * 0.1;
  line(width / 2 - lw / 2, height * 0.228, width / 2 + lw / 2, height * 0.228);
  noStroke();
}

// ---------- 底部：松开之后的落点 ----------
// 概念上是「已经放下的东西停在这里」，不再是 Todo 列表里被划掉的一行。
//（内部变量名沿用 done，避免大范围改动）

// DONE 区域的上边界（也是主画布活动范围的下边界）
function stripTop() {
  return height * (1 - STRIP_RATIO);
}

// DONE 区域里圆的直径
function doneD() {
  return width * DONE_D_RATIO;
}

// DONE 区域里第 slot 个已完成任务应该待的位置
function doneSlotPos(slot) {
  const d = doneD();
  const stripH = height * STRIP_RATIO;
  return {
    x: width * 0.05 + d / 2 + slot * d * 1.25, // 从左边开始，一个个往右排
    y: height - stripH / 2 + stripH * 0.12, // 竖直方向居中在 DONE 区域里
  };
}

function drawDoneZone() {
  // 一条几乎看不见的分隔线：把「还没做」和「做完了」轻轻分开
  stroke(C.divider);
  strokeWeight(1);
  line(0, stripTop(), width, stripTop());

  // 左下角的小标签，很小很淡（和上面那行文字入口是同一个概念）
  noStroke();
  textFont(FONT_REGULAR);
  fill(C.doneLabel);
  textAlign(LEFT, TOP);
  textSize(Math.max(9, width * 0.0135));
  text("LET GO", width * 0.05, stripTop() + height * 0.028);
}

// ---------- 任务圆：初始化 ----------

function initBubbles() {
  // 星体的基准直径（每颗再按重量略有不同）。
  // 尺寸要给「队形」留余量：星体越大，七颗能同时散开的空间越紧张，
  // 避让推力就会长期饱和、把轨道顶变形（实测 0.135 时无解，0.105 刚好）
  const baseD = width * 0.105;

  bubbles = [];

  for (let i = 0; i < TASKS.length; i++) {
    // 自己的轨道：半径从内到外铺开（避免全部挤在中央），
    // 再叠一点确定性的小偏移，免得七条轨道排得太整齐
    const ringR =
      RING_MIN +
      (RING_MAX - RING_MIN) * (i / (TASKS.length - 1)) +
      (((i * 5) % 4) - 1.5) * 0.02;

    // 初相位先占个位：真正的初始相位在下面按「黄金角」统一铺
    let phase = 0;

    // 重量：一开始是纯基础重量（会话刚打开，还没有累积），
    // 之后由 updateWeight() 每帧极慢地往上加
    const baseWeight = baseWeightOf(i);
    const sizeF = sizeFromWeight(baseWeight);

    const b = {
      label: TASKS[i],
      index: i, // 在 TASKS 里的位置（调试/验证时好对照）
      ageDays: AGE_DAYS[i], // 「已经待了多久」——内部数值，永远不显示
      baseWeight: baseWeight, // 由年龄决定的重量
      weight: baseWeight, // 当前重量（= 基础 + 会话累积），大小/速度/下沉都看它
      x: 0,
      y: 0,
      d: baseD * sizeF,
      sizeF: sizeF, // 当前的大小系数（由重量算出）
      ringR: ringR, // 自己那条轨道的半径（1 = 最外圈）
      ringFlat: 0.82 + 0.18 * (((i * 3) % 5) / 4), // 轨道扁平度，各条不同
      phase: phase, // 相位：每帧稳定前进，位置由它算出
      sepX: 0, // 避让用的临时位移偏移（画布空间，会自己衰减归零）
      sepY: 0,
      rOff: 0, // 取消选中后从当前位置滑回自己那一圈的半径差
      omega: 0, // 角速度，下面按轨道算
      speedJit: 0.99 + 0.02 * (((i * 7) % 5) / 4), // 每颗再叠 ±1% 的微差，避免完全同步
      nSeed: i * 13.7, // noise 轨迹起点，保证各飘各的
      orbiting: false, // 是否正处于「被选中公转」状态
      state: "off", // 当前画成什么样子，draw() 每帧更新
      vx: 0,
      vy: 0,
      orbitAngle: 0, // 「被选中」时才用到，和 phase 互不干扰
      orbitR: 0,
      done: false, // 已完成的任务不再参与运动
      slot: 0, // 在 DONE 区域里的位置
      landed: false, // 是否已经落进 DONE 区域（落地后彻底不动）
      squash: 0, // 落地压扁的程度，平时是 0
      startX: 0, // 下落动画的起点
      startY: 0,
    };
    b.omega = omegaFor(b);
    bubbles.push(b);
  }

  // 全部建好后再摆位置（依赖整组星体的最大直径）。
  // 初始相位整组一起寻优：反复轮流把每颗挪到自己轨道上最优的位置，
  // 直到七颗彼此都尽量远（比逐颗贪心的余量更大）
  optimizeInitialPhases();
}

// 由「相位」算出轨道上对应的点（不含抖动，专供初始化寻优用）
function phasePos(b, ph) {
  const m = orbitAxes();
  const ryB = m.ry * b.ringFlat;
  const cy = m.midY + dropOffset(b); // 越沉的星体，轨道中心越靠下
  return {
    x: m.midX + Math.cos(ph) * m.rx * b.ringR,
    y: cy + Math.sin(ph) * ryB * b.ringR,
  };
}

// 初始相位寻优：先均匀铺一圈，再整组做几十轮坐标下降——
// 每轮把每颗星体挪到自己轨道上「离别人最近距离最大化」的位置
function optimizeInitialPhases() {
  const n = bubbles.length;

  for (let i = 0; i < n; i++) bubbles[i].phase = (Math.PI * 2 * i) / n;

  for (let round = 0; round < 24; round++) {
    for (const b of bubbles) {
      let bestPhase = b.phase;
      let bestScore = -1;

      for (let s = 0; s < 64; s++) {
        const ph = (Math.PI * 2 * s) / 64;
        const p = phasePos(b, ph);

        // 评分：到其他所有星体的距离里最近的那段（按星体大小归一）
        let score = Infinity;
        for (const o of bubbles) {
          if (o === b) continue;
          const q = phasePos(o, o.phase);
          const ratio = Math.hypot(p.x - q.x, p.y - q.y) / ((b.d + o.d) / 2);
          if (ratio < score) score = ratio;
        }

        if (score > bestScore) {
          bestScore = score;
          bestPhase = ph;
        }
      }
      b.phase = bestPhase;
    }
  }

  for (const b of bubbles) {
    const p = phasePos(b, b.phase);
    b.x = p.x;
    b.y = p.y;
  }
}

// ---------- 任务圆：每帧更新位置 ----------

function updateBubble(b, i) {
  // 已完成的任务不再参与运动（多一层保护，调用方忘了判断也不会动）
  if (b.done) return;

  // 选中的圆：绕主画布中心公转，不再走自己那条轨道
  if (i === selected) {
    updateOrbit(b);
    return;
  }

  // 刚被取消选中的：从当前位置反推相位和半径，平滑接回自己的轨道
  if (b.orbiting) {
    b.orbiting = false;
    b.sepX = 0;
    b.sepY = 0;
    const u = normalizePos(b);
    b.phase = Math.atan2(u.y, u.x) - phaseWobble(b); // 反推相位（去掉抖动）
    b.rOff = Math.min(1.2, Math.max(-1.2, Math.hypot(u.x, u.y) - b.ringR));
  }

  // 半径差慢慢归零：星体从当前位置缓缓滑回自己那一圈
  b.rOff *= 0.97;

  // 相位稳定前进：一定在绕中心走，不会卡住也不会乱飞
  b.phase += omegaFor(b);

  const p = orbitPos(b);
  b.x = p.x;
  b.y = p.y;

  // 保底：绝不允许飘出画布（也进不了 DONE 区域）
  const bd = boundsFor(b);
  b.x = constrain(b.x, bd.minX, bd.maxX);
  b.y = constrain(b.y, bd.minY, bd.maxY);
}

// 轨道空间的中心和半轴（多处要用，统一在这里算）
function orbitAxes() {
  const midX = width / 2;
  const midY = stripTop() / 2;
  const maxD = maxBodyD();
  const rx = midX - maxD / 2 - 16;
  const ry = midY - maxD / 2 - 16;
  return { midX, midY, rx, ry };
}

// 星体在「归一化轨道空间」里的坐标（中心是 0，最外圈半径是 1）
function normalizePos(b) {
  const m = orbitAxes();
  return {
    x: (b.x - m.midX) / m.rx,
    // 减掉自己那条轨道的下沉量，才是相对于轨道的坐标
    y: (b.y - m.midY - dropOffset(b)) / (m.ry * b.ringFlat),
  };
}

// 相位抖动：缓慢的 noise 晃动，让轨迹不是标准椭圆
function phaseWobble(b) {
  return (noise(b.nSeed, frameCount * NOISE_STEP) - 0.5) * PHASE_WOBBLE * 2;
}

// 半径呼吸：轨道半径非常缓慢地一收一放
function radiusBreathe(b) {
  return (
    1 + (noise(b.nSeed + 50, frameCount * NOISE_STEP * 0.6) - 0.5) * BREATHE * 2
  );
}

// 由相位算出星体此刻应该在的位置
function orbitPos(b) {
  const m = orbitAxes();
  const ryB = m.ry * b.ringFlat;

  // 压力越高，整圈轨道一起往中心收一点点（最多 9%），
  // 所以未完成的事越多，整个星系看起来越挤；做完一件就慢慢松回来
  const shrink = 1 - P_SHRINK * pressure;

  // 半径呼吸，最外圈封顶到 1，保证不出界
  const reff = Math.min(1, (b.ringR * shrink + b.rOff) * radiusBreathe(b));
  const ph = b.phase + phaseWobble(b);

  // 轨道中心：整组共享一个中心，但越沉的星体再单独往下沉一点点
  const cy = m.midY + dropOffset(b);

  return {
    x: m.midX + Math.cos(ph) * m.rx * reff + b.sepX,
    y: cy + Math.sin(ph) * ryB * reff + b.sepY,
  };
}

// 目前最大的星体直径：算轨道半轴时要用，保证任何一颗都不会出界
function maxBodyD() {
  let m = 0;
  for (const b of bubbles) {
    if (!b.done && b.d > m) m = b.d;
  }
  return m || width * 0.105;
}

// 这颗星体允许活动的范围（主画布内，且留出自身半径，DONE 区域不能进）
function boundsFor(b) {
  const r = b.d / 2;
  return { minX: r, maxX: width - r, minY: r, maxY: stripTop() - r };
}

// 星体之间轻轻地「让位」：靠得太近时，各自沿连线往反方向挪一点点。
// 挪的是 sepX/sepY（会自己衰减的临时偏移），不碰轨道相位——
// 所以只是暂时保持距离，轨道本身不会变形，也不会被推离自己的那一圈
// （位置每帧都由相位重新算出，任何偏移都只是叠加在轨道上的短暂让步）
function separateBodies() {
  for (const b of bubbles) {
    if (!b.done) {
      b.sepX *= 0.96; // 没人挤它时，让位偏移慢慢消失，星体滑回轨道
      b.sepY *= 0.96;
    }
  }

  for (let a = 0; a < bubbles.length; a++) {
    for (let c = a + 1; c < bubbles.length; c++) {
      const A = bubbles[a];
      const B = bubbles[c];
      if (A.done || B.done) continue; // 已完成的不参与
      if (a === selected || c === selected) continue; // 被选中公转的不参与

      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      const need = (A.d + B.d) / 2; // 刚好不重叠的距离

      // 安全间距：平时留 30% 余量，压力越高余量越小（最多收到 25%），
      // 所以未完成的事越多，星体就越容易彼此贴近、擦肩而过
      const pack = 1.3 - P_PACK * pressure;

      if (d > 0.001 && d < need * pack) {
        // 还差多少才到安全间距，每帧只补差距的一小部分（柔性弹簧，不是碰撞）。
        // 压力高时推力也大一点：允许靠得更近，但不允许深深地叠在一起
        const deficit = need * pack - d;
        const k = deficit * 0.04 * 0.5 * (1 + 0.3 * pressure); // 一颗星体每帧挪多少（最多约 1.5 像素）
        const nx = dx / d;
        const ny = dy / d;
        A.sepX -= nx * k;
        A.sepY -= ny * k;
        B.sepX += nx * k;
        B.sepY += ny * k;
      }
    }
  }

  // 偏移封顶：无论怎么挤，让位的幅度都有限（轨道不会因此明显变形）。
  // 压力高时上限也放宽一点，配合上面加大的推力，保证挤而不叠
  for (const b of bubbles) {
    if (b.done) continue;
    const cap = 40 * (1 + 0.25 * pressure);
    const sm = Math.hypot(b.sepX, b.sepY);
    if (sm > cap) {
      b.sepX *= cap / sm;
      b.sepY *= cap / sm;
    }
  }
}

// 绕主画布中心公转
function updateOrbit(b) {
  const areaH = stripTop(); // 主画布的高度
  const shrink = 1 - P_SHRINK * pressure; // 和轨道一样，压力高时整体收一点
  const targetR =
    (Math.min(width, areaH) / 2 - b.d / 2 - 12) * shrink; // 贴内圈，保证不出界
  const cy = areaH / 2 + dropOffset(b); // 同样带上下沉，进出公转不会跳一下

  // 半径慢慢收到目标值，避免从当前位置瞬间跳到轨道上
  b.orbitR += (targetR - b.orbitR) * 0.06;

  // 压力高时公转也略快一点（和轨道上的星体同一个系数），
  // 同样跟着呼吸做 ±3% 的极慢起伏
  b.orbitAngle +=
    ORBIT_SPEED *
    (1 + P_SPEED * pressure) *
    (1 + P_BREATH_SPEED * pressure * breath);
  b.x = width / 2 + Math.cos(b.orbitAngle) * b.orbitR;
  b.y = cy + Math.sin(b.orbitAngle) * b.orbitR;
}

// 已完成的圆：先加速往下掉，落到 DONE 区域里自己的位置就停住
function updateDone(b) {
  // 落地压扁的余震：慢慢弹回原样（和是否在下落无关，要一直跑）
  b.squash *= 0.82;

  if (b.landed) return; // 已经落地：彻底不动了

  const target = doneSlotPos(b.slot);

  // 竖向：每帧把下落速度再加一点，所以是越掉越快，不是匀速下降
  b.vy += height * GRAVITY_RATIO;
  b.y += b.vy;

  // 横向：用「已经掉了多少」来带动，
  // 这样落地的那一刻正好对齐自己的槽位，不会横着飘过去
  const p = (b.y - b.startY) / (target.y - b.startY);
  b.x = b.startX + (target.x - b.startX) * Math.min(1, Math.max(0, p));

  // 一边掉一边缩回 DONE 的尺寸
  b.d += (doneD() - b.d) * 0.14;

  // 掉到位：啪，落地
  if (b.y >= target.y) {
    b.x = target.x;
    b.y = target.y;
    b.d = doneD();
    b.vy = 0;
    b.landed = true;
    b.squash = 1; // 触发压扁，之后由上面的衰减收回去
  }
}

// ---------- 任务圆：画一颗星体 + 圆里的任务名 ----------

// 在星体外面罩一层柔和的径向光晕：中心稍实，越往外越透明，像星光散开
function drawGlow(x, y, r, color) {
  const ctx = drawingContext;
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- 分三层画，谁都不会糊到谁 ----------
// 三个函数都读 b.state（"off" 普通 / "on" 选中 / "done" 已完成）

// 这一层的光晕颜色：压力越高越亮一点（最多 35%），
// 并且随呼吸非常缓慢地一明一暗（最多 ±14%）。
// 已完成的不受影响——它们已经安静下来了，不参与呼吸
function glowColor(state) {
  const col = C.bubbles[state];
  const boost =
    state === "done"
      ? 1
      : (1 + P_GLOW * pressure) * (1 + P_BREATH_GLOW * pressure * breath);
  return `rgba(${col.glow}, ${Math.min(1, col.glowA * boost)})`;
}

// 第 1 层：非常轻微的光晕，画在所有星体的最下面
function drawHalo(b) {
  // 选中：光晕稍大稍亮一点，作为唯一的「高亮」提示
  drawGlow(b.x, b.y, b.d * (b.state === "on" ? 0.98 : 0.85), glowColor(b.state));
}

// 第 2 层：星体本体——深色球体 + 一圈微光的边
// 落地那一刻会横向压扁、纵向变矮，做出「啪」的感觉；
// 平时的 squash 是 0，所以画出来就是个正圆
function drawBody(b) {
  const col = C.bubbles[b.state];
  stroke(col.stroke);
  strokeWeight(Math.max(1, b.d * (b.state === "on" ? 0.022 : 0.016)));
  fill(col.fill);
  ellipse(b.x, b.y, b.d * (1 + b.squash * SQUASH), b.d * (1 - b.squash * SQUASH));
}

// 第 3 层：任务文字。画在最上面，且落在不透明的本体上，
// 所以光晕影响不到它，始终是清楚的
function drawLabel(b) {
  const col = C.bubbles[b.state];

  noStroke();
  textFont(FONT_LIGHT);
  fill(col.text);
  textAlign(CENTER, CENTER);

  // 先按圆直径定字号，再看实际文字宽度决定要不要缩小
  // maxTextWidth 取直径的 0.7 倍（约等于圆的内接正方形边长），保证文字不溢出圆形
  textSize(b.d * 0.17);
  const maxTextWidth = b.d * 0.7;
  const w = textWidth(b.label);
  if (w > maxTextWidth) {
    textSize(textSize() * (maxTextWidth / w));
  }

  text(b.label, b.x, b.y);
}

// ---------- 画布尺寸自适应 ----------

// 窗口被缩放时：画布跟着变，圆的位置也按比例跟着变
function windowResized() {
  const oldW = width;
  const oldH = height;

  resizeToFit();

  if (oldW > 0 && oldH > 0 && bubbles.length > 0) {
    const sx = width / oldW;
    const sy = height / oldH;
    const baseD = width * 0.105;

    for (const b of bubbles) {
      b.x *= sx;
      b.y *= sy;

      if (b.done) {
        b.startX *= sx; // 下落动画的起点也跟着缩放
        b.startY *= sy;

        if (b.landed) {
          // 已经落地的：直接摆到新画布算出来的槽位上
          const target = doneSlotPos(b.slot);
          b.x = target.x;
          b.y = target.y;
          b.d = doneD();
        }
        // 还在往下掉的：位置不动，让它按新画布继续掉完
      } else {
        // 大小由重量算出，和初始化的口径完全一致
        b.d = baseD * sizeFromWeight(b.weight);
        // 没在公转的星体，位置下一帧由相位重新算出，不用额外处理
      }
    }
    // 选中的那个圆，下一帧会按新画布重新算轨道，不用额外处理
  }
}

// 把画布尺寸调整成「容器宽度 × 等比高度」
function resizeToFit() {
  const holder = document.getElementById("canvas-holder");
  const w = holder.clientWidth;
  if (w > 0) {
    resizeCanvas(w, Math.round(w * RATIO));
  }
}
