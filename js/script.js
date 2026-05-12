gsap.registerPlugin(MorphSVGPlugin);
var count = 0;

//切換頁面
const writingZone = document.getElementById("writingZone")
const menu = document.getElementById("menu")
writingZone.style.display = "none"

document.getElementById("ok").addEventListener("click", () => {
    writingZone.style.display = "block"
    menu.style.display = "none"

    // ✅ FIX: wait for layout, then resize
    requestAnimationFrame(() => {
        resizeCanvas();
    });
});

//設定按鈕
document.getElementById("setting").addEventListener("click", () => {
    writingZone.style.display = "none"
    menu.style.display = "block"
})

// mroph效果
morphTweens = []
for (let i = 0; i < pathAmount; i++) {
    const morphTween = gsap.to(".start" + String(i), {
        morphSVG: ".end" + String(i),
        ease: "none",
        paused: true
    });
    morphTweens.push(morphTween)
}
// 滑桿
const slider = document.getElementById("morphSlider");
slider.addEventListener("input", () => {
    document.getElementById("morphValue").textContent = slider.value * 100
    for (let i = 0; i < morphTweens.length; i++)
        morphTweens[i].progress(slider.value);
});

//隱藏灰色線
const hideGray = document.getElementById("hideGray")
hideGray.addEventListener("click", function () {
    var grayVisible = document.getElementById("guideSvg")
    if (grayVisible.style.visibility != "hidden") {
        grayVisible.style.visibility = "hidden";
        hideGray.textContent = "顯示灰色字"
    }

    else {
        grayVisible.style.visibility = "visible";
        hideGray.textContent = "隱藏灰色字"
    }
})

const guideSelector = document.getElementById("guideSelector")
const four = document.getElementById("four")
const nine = document.getElementById("nine")
guideSelector.addEventListener('change', () => {
    if (guideSelector.value == "four") {
        four.style.visibility = "visible"
        nine.style.visibility = "hidden"
    }
    else if (guideSelector.value == "nine") {
        four.style.visibility = "hidden"
        nine.style.visibility = "visible"
    }
    else {
        four.style.visibility = "hidden"
        nine.style.visibility = "hidden"
    }
});

// ===============================
// Canvas setup
// ===============================
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

// ===============================
// Config
// ===============================
var MIN_WIDTH = 1;
var MAX_WIDTH = 20;
document.getElementById("max").addEventListener("change", function () {
    MAX_WIDTH = document.getElementById("max").value;
    MIN_WIDTH = document.getElementById("min").value;
    if (MAX_WIDTH <= MIN_WIDTH) {
        console.log("yea")
        MIN_WIDTH = parseInt(parseInt(MAX_WIDTH) - 5)
    }
    console.log(MIN_WIDTH, MAX_WIDTH)
})
document.getElementById("min").addEventListener("change", function () {
    MAX_WIDTH = document.getElementById("max").value;
    MIN_WIDTH = document.getElementById("min").value;
    if (MAX_WIDTH <= MIN_WIDTH) {
        console.log("yea")
        MAX_WIDTH = parseInt(parseInt(MIN_WIDTH) + 5)
    }

    console.log(MIN_WIDTH, MAX_WIDTH)
})
const SIMPLIFY_DISTANCE = 2;
const SMOOTH_WINDOW = 2;

// ===============================
// State
// ===============================
let drawing = false;
let strokePoints = [];


function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ===============================
// Helpers
// ===============================
function getWidth(pressure) {
    if (pressure === 0) pressure = 0.5; // mouse fallback
    return MIN_WIDTH + pressure * (MAX_WIDTH - MIN_WIDTH);
}

function drawPreview(p0, p1) {
    ctx.lineWidth = p1.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
}

// ===============================
// Point processing
// ===============================
function simplifyPoints(points, minDistance) {
    const result = [points[0]];
    let last = points[0];

    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const dx = p.x - last.x;
        const dy = p.y - last.y;

        if (dx * dx + dy * dy >= minDistance * minDistance) {
            result.push(p);
            last = p;
        }
    }

    return result;
}

function smoothPoints(points, windowSize) {
    const smoothed = [];

    for (let i = 0; i < points.length; i++) {
        let sumX = 0, sumY = 0, sumW = 0, count = 0;

        for (let j = -windowSize; j <= windowSize; j++) {
            const idx = i + j;
            if (idx >= 0 && idx < points.length) {
                sumX += points[idx].x;
                sumY += points[idx].y;
                sumW += points[idx].w;
                count++;
            }
        }

        smoothed.push({
            x: sumX / count,
            y: sumY / count,
            w: sumW / count
        });
    }

    return smoothed;
}

// ===============================
// Outline generation
// ===============================
function buildOutline(points) {
    const left = [];
    const right = [];

    for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];

        let dx = p1.x - p0.x + p2.x - p1.x;
        let dy = p1.y - p0.y + p2.y - p1.y;

        const len = Math.hypot(dx, dy);
        if (len === 0) continue;

        dx /= len;
        dy /= len;

        const nx = -dy;
        const ny = dx;
        const w = p1.w / 2;

        left.push({
            x: p1.x + nx * w,
            y: p1.y + ny * w
        });

        right.push({
            x: p1.x - nx * w,
            y: p1.y - ny * w
        });
    }

    right.reverse();
    return [...left, ...right];
}

//輸出svg
function exportStrokeAsFilledSVG(rawPoints) {
    if (rawPoints.length < 4) return;

    let points = simplifyPoints(rawPoints, SIMPLIFY_DISTANCE);
    points = smoothPoints(points, SMOOTH_WINDOW);

    const outline = buildOutline(points);
    if (outline.length < 3) return;

    // SVG real space is 1000x1000 because of scale(0.1)
    const SVG_SIZE = 1000;

    const scaleX = SVG_SIZE / canvas.clientWidth;
    const scaleY = SVG_SIZE / canvas.clientHeight;

    let d = `M ${outline[0].x * scaleX} ${outline[0].y * scaleY}`;

    for (let i = 1; i < outline.length; i++) {
        d += ` L ${outline[i].x * scaleX} ${outline[i].y * scaleY}`;
    }

    d += " Z";

    document.querySelector(".start" + count).setAttribute("d", d);
    count++;
}

//下載svg
function downloadSVG(svgText) {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "morphed-stroke.svg";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportCurrentMorphSVG() {
    const svg = document.querySelector(".morphSvg");

    // clone so live DOM is untouched
    const clone = svg.cloneNode(true);

    // 🔥 REMOVE morph targets (end paths)
    clone.querySelectorAll(".endClass").forEach(el => el.remove());
    // optional: remove inline styles GSAP might add
    clone.querySelectorAll("*").forEach(el => {
        el.removeAttribute("style");
    });

    // serialize
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    source = `<?xml version="1.0" encoding="UTF-8"?>\n` + source;

    svgText = source;
    getSVG();
    // downloadSVG(source);
    //清除畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokePoints = [];
    count = 0
}


const exportBtn = document.getElementById("exportBtn")
exportBtn.addEventListener("click", exportCurrentMorphSVG);


// ===============================
// Pointer events (S-Pen safe)
// ===============================
canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    drawing = true;
    strokePoints = [];

    strokePoints.push({
        x: e.offsetX,
        y: e.offsetY,
        w: getWidth(e.pressure)
    });
});

canvas.addEventListener("pointermove", e => {
    e.preventDefault();
    if (!drawing || e.buttons !== 1) return;

    const p = {
        x: e.offsetX,
        y: e.offsetY,
        w: getWidth(e.pressure)
    };

    const prev = strokePoints[strokePoints.length - 1];
    drawPreview(prev, p);
    strokePoints.push(p);
});

canvas.addEventListener("pointerup", () => {
    drawing = false;
    exportStrokeAsFilledSVG(strokePoints);
});

canvas.addEventListener("pointercancel", () => {
    drawing = false;
});
