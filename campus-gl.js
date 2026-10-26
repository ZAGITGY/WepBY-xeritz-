/* ============================================================================
 * campus-gl.js — LVC v10 ภาพวิทยาลัย "จากหุ่นจำลองสีขาว สู่ภาพสีแบบสีน้ำ" (WebGL)
 *
 * ใช้ร่วมกันโดย intro.js (ฉากเข้าเว็บ) และ campus-backdrop.js (พื้นหลังหน้าแรก)
 *   • ภาพจาง (ghost): ภาพถ่ายถูกล้างสีจนเหลือแค่โครงอ่อน ๆ บนกระดาษ แบบหุ่นจำลองสถาปัตยกรรมในคลิปอ้างอิง
 *   • สีซึม: วงสีจากหลายจุด ขอบเป็นคลื่นแบบสีน้ำ มีริ้วไหลลงแนวตั้ง สีเข้มขึ้นเล็กน้อยที่ขอบเหมือนสีน้ำแห้ง
 *   • ม่านกระดาษ (veil): ทำให้ด้านที่มีตัวหนังสืออ่านง่าย
 * ใช้ภาพเดียว (images/campus.webp) ไม่มีไฟล์ภาพจางแยก · ไม่มี WebGL → create() คืน null แล้วผู้เรียกใช้แบบ CSS
 *
 *   LVCCampus.create(canvas, opts) → ตัววาด หรือ null
 *   LVCCampus.intro(frame, t, size) → ค่าท่าฉากเข้าเว็บ ณ วินาทีที่ t (นับจากภาพพร้อม)
 *   LVCCampus.hero(frame, t, size, o) → ค่าท่าพื้นหลังหน้าแรก (ใช้ทั้งสองไฟล์ ภาพจึงต่อกันพอดีทุกพิกเซล)
 *   LVCCampus.mix(a, b, k) → ค่ากึ่งกลางระหว่างสองท่า (ใช้ตอนส่งต่อจากฉากเข้าเว็บไปหน้าแรก)
 * ค่ากรอบทุกตัวเป็นพิกเซลจริงของ canvas [x, y, กว้าง, สูง] นับจากมุมซ้ายบน
 * ============================================================================ */
(function () {
  "use strict";
  if (window.LVCCampus) return;

  var SEEDS = 10;           // จำนวนจุดสีสูงสุดที่ชิดเดอร์รับได้ (ฉากเข้าเว็บ 6 + หน้าแรก 4 ระหว่างส่งต่อ)
  var SRC = "./images/campus.webp";

  var VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}";
  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform sampler2D uTex;",
    "uniform vec2 uRes;",
    "uniform vec4 uFrame;",
    "uniform vec4 uImg;",
    "uniform vec3 uPaper;",
    "uniform vec3 uFrost;",
    "uniform vec3 uSkyTint;",
    "uniform vec3 uGlow;",
    "uniform float uTime;",
    "uniform float uGhost;",
    "uniform float uGhostMix;",
    "uniform float uReveal;",
    "uniform vec4 uSeeds[" + SEEDS + "];",
    "uniform float uEdge;",
    "uniform float uWarp;",
    "uniform float uFeather;",
    "uniform float uSoft;",
    "uniform float uRim;",
    "uniform float uSat;",
    "uniform float uBright;",
    "uniform float uWash;",
    "uniform vec4 uVeil;",
    "uniform float uVeilAmt;",
    "uniform float uBottom;",
    "uniform float uSweep;",
    "uniform float uClouds;",
    "uniform float uGrain;",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float vnoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<3;i++){v+=a*vnoise(p);p=p*2.03+vec2(17.1,9.2);a*=0.5;}return v/0.875;}",
    "float fbm2(vec2 p){return (vnoise(p)*0.5+vnoise(p*2.03+vec2(17.1,9.2))*0.25)/0.75;}",
    "float lum(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}",
    "void main(){",
    "  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);",
    "  vec2 f=(px-uFrame.xy)/uFrame.zw;",
    "  vec2 uv=(px-uImg.xy)/uImg.zw;",
    "  vec3 col=texture2D(uTex,clamp(uv,vec2(0.0005),vec2(0.9995))).rgb;",
    "  float L=lum(col);",
    "  float sky=smoothstep(0.05,0.15,col.b-col.r)*smoothstep(0.45,0.7,col.b);",
    "  vec2 fa=f*vec2(uFrame.z/uFrame.w,1.0);",
    // เมฆเคลื่อนช้า ๆ (เฉพาะส่วนท้องฟ้า)
    "  float cloud=0.0;",
    "  if(uClouds>0.0&&sky>0.01){cloud=(fbm(uv*vec2(3.2,1.7)+vec2(uTime*0.012,0.0))-0.45)*sky*uClouds;}",
    // ภาพจางแบบหุ่นจำลองสีขาว: ล้างสี ยกขึ้นไปทางสีกระดาษ เก็บโครงไว้นิดเดียว ท้องฟ้าอมฟ้าอ่อน
    "  vec3 grey=mix(vec3(L),col,0.22);",
    "  vec3 ghost=mix(uFrost,grey,uGhostMix);",
    "  ghost=mix(ghost,uSkyTint,sky*0.45)+cloud*0.5;",
    "  float rev=1.0;",
    "  if(uReveal<1.0){float dg=(1.0-f.y)*0.55+f.x*0.30+(fbm(fa*3.0)-0.5)*0.35;rev=smoothstep(dg,dg+0.22,uReveal*1.32);}",
    "  vec3 base=mix(uPaper,ghost,uGhost*rev);",
    // ช่องสีแบบสีน้ำ: วงจากหลายจุด บิดรูปด้วย noise (ไม่กลม) + ขอบหยัก + ริ้วไหลลงแนวตั้ง + ขอบฟุ้งเป็นเส้นใยกระดาษ
    "  vec2 w=vec2(fbm2(fa*1.6+vec2(3.1,uTime*0.02)),fbm2(fa*1.6+vec2(11.7,-uTime*0.017)))-0.5;",
    "  vec2 fw=f+w*uWarp*vec2(uFrame.w/uFrame.z,1.0);",
    "  float fld=-1.0;",
    "  for(int i=0;i<" + SEEDS + ";i++){vec4 s=uSeeds[i];if(s.z>0.0001){vec2 d=(fw-s.xy)/s.zw;fld=max(fld,1.0-length(d));}}",
    "  float n=fbm(fa*6.0+vec2(0.0,uTime*0.04))-0.5;",
    "  float n2=fbm(vec2(fa.x*10.0,fa.y*1.2)+vec2(uTime*0.01,0.0))-0.5;",
    "  float n3=vnoise(fa*36.0)*0.6+vnoise(fa*90.0+7.7)*0.4-0.5;",
    "  fld+=(n*0.8+n2*0.9)*uEdge+n3*uFeather;",
    "  float m=smoothstep(-uSoft,uSoft,fld);",
    "  float pool=smoothstep(0.0,uSoft*3.0,fld)*(1.0-smoothstep(uSoft*3.0,uSoft*14.0,fld));",
    "  float halo=smoothstep(-uSoft*12.0,-uSoft,fld)*(1.0-m);",
    "  vec3 photo=mix(vec3(L),col,uSat)*uBright+cloud;",
    "  photo=mix(photo,ghost,uWash);",
    "  photo*=1.0-0.07*pool;",
    "  vec3 c=mix(base,photo,m);",
    "  c=mix(c,mix(base,photo,0.22),halo*uRim);",
    "  if(uSweep>-0.5){float sw=exp(-pow((f.x*0.75+f.y*0.45-uSweep)/0.07,2.0));c+=vec3(1.0,0.96,0.88)*sw*0.10*m;}",
    // ม่านกระดาษให้ตัวหนังสืออ่านง่าย + ขอบล่างจางเข้ากระดาษ
    "  float v=(1.0-smoothstep(uVeil.z,uVeil.w,dot(f,uVeil.xy)))*uVeilAmt;",
    "  if(uBottom>0.0){v=max(v,smoothstep(1.0-uBottom,1.0,f.y)*0.94);}",
    "  float inImg=step(0.0,uv.x)*step(0.0,uv.y)*step(uv.x,1.0)*step(uv.y,1.0);",
    "  float inFrame=step(0.0,f.x)*step(0.0,f.y)*step(f.x,1.0)*step(f.y,1.0);",
    "  c=mix(c,uPaper,max(v,1.0-inImg));",
    "  c=mix(uPaper,c,inFrame);",
    "  c+=(hash(px+fract(uTime*0.37)*93.1)-0.5)*uGrain;",
    "  gl_FragColor=vec4(c,1.0);",
    "}"
  ].join("\n");

  var SCALARS = ["uTime", "uGhost", "uGhostMix", "uReveal", "uEdge", "uWarp", "uFeather", "uSoft", "uRim", "uSat", "uBright", "uWash", "uVeilAmt", "uBottom", "uSweep", "uClouds", "uGrain"];

  /* ---------- ภาพ (ถอดรหัสครั้งเดียว ใช้ร่วมกันทั้งฉากเข้าเว็บและพื้นหลัง) ---------- */
  var images = {};
  function loadImage(url) {
    url = url || SRC;
    if (!images[url]) {
      images[url] = new Promise(function (resolve, reject) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () {
          var done = function () { resolve(img); };
          if (img.decode) img.decode().then(done, done); else done();
        };
        img.onerror = function () { reject(new Error("campus image failed: " + url)); };
        img.src = url;
      });
      images[url].catch(function () {});
    }
    return images[url];
  }

  function noWebGL() { return /[?&]no-webgl(=|&|$)/.test(location.search); }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(log || "shader");
    }
    return s;
  }

  function create(canvas, opts) {
    opts = opts || {};
    if (noWebGL()) return null;
    var attrs = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" };
    var gl = null;
    try { gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs); } catch (e) { gl = null; }
    if (!gl) return null;

    var prog, buf, texture, loc = {}, ok = false, lost = false, texSize = [1536, 1024];
    var seedBuf = new Float32Array(SEEDS * 4);
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
    } catch (error) {
      if (window.console) console.warn("[campus-gl]", error);
      try { var x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); } catch (e) {}
      return null;
    }
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    ["uTex", "uRes", "uFrame", "uImg", "uPaper", "uFrost", "uSkyTint", "uGlow", "uVeil"].concat(SCALARS).forEach(function (name) {
      loc[name] = gl.getUniformLocation(prog, name);
    });
    loc.uSeeds = gl.getUniformLocation(prog, "uSeeds[0]");
    texture = gl.createTexture();

    var api = {
      canvas: canvas,
      get ready() { return ok && !lost; },
      get lost() { return lost; },
      size: function () { return texSize.slice(); },
      resize: function (cssW, cssH, dpr) {
        var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        return [w, h];
      },
      draw: function (u) {
        if (!ok || lost) return false;
        var W = canvas.width, H = canvas.height;
        gl.viewport(0, 0, W, H);
        gl.useProgram(prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(loc.uTex, 0);
        gl.uniform2f(loc.uRes, W, H);
        gl.uniform4f(loc.uFrame, u.frame[0], u.frame[1], Math.max(1, u.frame[2]), Math.max(1, u.frame[3]));
        gl.uniform4f(loc.uImg, u.img[0], u.img[1], Math.max(1, u.img[2]), Math.max(1, u.img[3]));
        var C = u.colors;
        gl.uniform3fv(loc.uPaper, C.paper);
        gl.uniform3fv(loc.uFrost, C.frost);
        gl.uniform3fv(loc.uSkyTint, C.sky);
        gl.uniform3fv(loc.uGlow, C.glow);
        gl.uniform4fv(loc.uVeil, u.veil);
        for (var i = 0; i < SEEDS; i++) {
          var s = u.seeds[i];
          seedBuf[i * 4] = s ? s[0] : 0; seedBuf[i * 4 + 1] = s ? s[1] : 0;
          seedBuf[i * 4 + 2] = s ? Math.max(0, s[2]) : 0; seedBuf[i * 4 + 3] = s ? Math.max(0.0001, s[3]) : 1;
        }
        gl.uniform4fv(loc.uSeeds, seedBuf);
        gl.uniform1f(loc.uTime, u.time % 3600);
        gl.uniform1f(loc.uGhost, u.ghost);
        gl.uniform1f(loc.uGhostMix, C.ghostMix);
        gl.uniform1f(loc.uReveal, u.reveal);
        gl.uniform1f(loc.uEdge, u.edge);
        gl.uniform1f(loc.uWarp, u.warp);
        gl.uniform1f(loc.uFeather, u.feather);
        gl.uniform1f(loc.uSoft, u.soft);
        gl.uniform1f(loc.uRim, u.rim);
        gl.uniform1f(loc.uSat, C.sat);
        gl.uniform1f(loc.uBright, C.bright);
        gl.uniform1f(loc.uWash, u.wash);
        gl.uniform1f(loc.uVeilAmt, u.veilAmt);
        gl.uniform1f(loc.uBottom, u.bottom);
        gl.uniform1f(loc.uSweep, u.sweep);
        gl.uniform1f(loc.uClouds, u.clouds);
        gl.uniform1f(loc.uGrain, u.grain);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return true;
      },
      dispose: function () {
        if (lost) return;
        lost = true;
        try {
          gl.deleteTexture(texture); gl.deleteBuffer(buf); gl.deleteProgram(prog);
          var ext = gl.getExtension("WEBGL_lose_context");
          if (ext) ext.loseContext();
        } catch (e) {}
      }
    };

    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      if (lost) return;
      lost = true;
      if (opts.onLost) opts.onLost();
    }, false);

    api.whenReady = loadImage(opts.src).then(function (img) {
      if (lost) throw new Error("context lost");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("texture upload");
      texSize = [img.naturalWidth || 1536, img.naturalHeight || 1024];
      ok = true;
      return api;
    });
    return api;
  }

  /* ---------- สีตามโหมดสว่าง / มืด ----------
   * paper อ่านจากสีพื้นจริงของหน้า (ส่งเข้ามาเป็น rgb string) ภาพจึงกลืนกับพื้นหลังโดยไม่มีรอยต่อ */
  function parseRGB(str, fallback) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(str || "");
    return m ? [m[1] / 255, m[2] / 255, m[3] / 255] : fallback;
  }
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
  function colors(paperCss) {
    if (isDark()) {
      var pd = parseRGB(paperCss, [0.094, 0.086, 0.098]);
      return { dark: true, paper: pd, frost: [pd[0] * 1.25 + 0.035, pd[1] * 1.25 + 0.034, pd[2] * 1.25 + 0.04],
        sky: [0.21, 0.25, 0.33], glow: [0.86, 0.70, 0.45], ghostMix: 0.34, sat: 0.92, bright: 0.84 };
    }
    var pl = parseRGB(paperCss, [0.980, 0.976, 0.965]);
    return { dark: false, paper: pl, frost: [Math.min(1, pl[0] + 0.008), Math.min(1, pl[1] + 0.009), Math.min(1, pl[2] + 0.012)],
      sky: [0.86, 0.905, 0.955], glow: [1.0, 0.85, 0.60], ghostMix: 0.2, sat: 1.04, bright: 1.0 };
  }

  /* ---------- วางภาพเต็มกรอบพร้อมจุดโฟกัส (fx, fy = ตำแหน่งในภาพ 0–1 ที่อยากให้อยู่กลางกรอบ) ---------- */
  function cover(frame, size, fx, fy, zoom) {
    var s = Math.max(frame[2] / size[0], frame[3] / size[1]) * (zoom || 1);
    var w = size[0] * s, h = size[1] * s;
    var x = frame[0] + frame[2] * 0.5 - w * fx, y = frame[1] + frame[3] * 0.5 - h * fy;
    x = Math.min(frame[0], Math.max(frame[0] + frame[2] - w, x));
    y = Math.min(frame[1], Math.max(frame[1] + frame[3] - h, y));
    return [x, y, w, h];
  }
  function portrait(frame) { return frame[2] <= frame[3] * 0.95; }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function seg(t, a, d) { return clamp((t - a) / d, 0, 1); }
  function ease(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }

  // จุดเริ่มสีในภาพ (พิกัดในภาพ 0–1): ป้ายชื่อวิทยาลัย → สวนกลาง → ผนังกระเบื้อง → ต้นไม้ซ้าย → เสาธง → ลาน
  // r = รัศมีช่วงสีซึม (สัดส่วนของเส้นทแยงจอ) จากนั้นทุกวงขยายจนเต็มจอพร้อมกันช่วง flood
  var BLOOM = [
    { u: 0.80, v: 0.40, at: 0.00, dur: 3.00, r: 0.34 },
    { u: 0.47, v: 0.62, at: 0.40, dur: 2.70, r: 0.24 },
    { u: 0.13, v: 0.24, at: 0.70, dur: 2.60, r: 0.24 },
    { u: 0.07, v: 0.60, at: 0.95, dur: 2.40, r: 0.22 },
    { u: 0.72, v: 0.76, at: 1.15, dur: 2.30, r: 0.20 },
    { u: 0.36, v: 0.95, at: 1.40, dur: 2.20, r: 0.24 }
  ];
  // วินาทีนับจากภาพพร้อม: ภาพจางปรากฏ → ค้างภาพขาว → สีซึม → สีเต็มจอ
  var INTRO = { reveal: 0.9, bloomAt: 1.05, floodAt: 3.95, flood: 0.95, floodR: 1.45, title: 2.1, full: 4.9 };

  function base(frame, img, t, colorsObj) {
    return {
      frame: frame, img: img, time: t,
      ghost: 1, reveal: 1, seeds: [],
      edge: 0.30, warp: 0.20, feather: 0.04, soft: 0.012, rim: 0.6, wash: 0, veil: [1, 0, 0, 1], veilAmt: 0, bottom: 0,
      sweep: -1, clouds: 0.05, grain: 0.014, colors: colorsObj
    };
  }

  /* ---------- ท่าฉากเข้าเว็บ ณ วินาทีที่ t (นับจากภาพพร้อม) ---------- */
  function intro(frame, t, size, paperCss, now) {
    var tall = portrait(frame);
    var cam = ease(seg(t, 0, INTRO.full + 0.4));
    var img = tall ? cover(frame, size, lerp(0.70, 0.62, cam), 0.44, 1.06 - 0.05 * cam)
                   : cover(frame, size, 0.55, 0.42, lerp(1.12, 1.04, cam));
    var u = base(frame, img, (now || 0) / 1000, colors(paperCss));
    u.reveal = easeOut(seg(t, 0.05, INTRO.reveal));
    var diag = Math.hypot(frame[2], frame[3]);
    var kf = ease(seg(t, INTRO.floodAt, INTRO.flood));
    u.seeds = BLOOM.map(function (b) {
      var g = seg(t, INTRO.bloomAt + b.at, b.dur), k = 1 - (1 - g) * (1 - g);
      var r = lerp(k * b.r, INTRO.floodR, kf) * diag;
      var x = (img[0] + img[2] * b.u - frame[0]) / frame[2];
      var y = (img[1] + img[3] * b.v - frame[1]) / frame[3];
      return [x, y, r / frame[2], r / frame[3], b.u, b.v];
    });
    var sw = seg(t, INTRO.floodAt + 0.2, 1.5);
    u.sweep = sw > 0 && sw < 1 ? -0.3 + sw * 1.9 : -1;
    u.grain = 0.016;
    return u;
  }

  /* ---------- ท่าพื้นหลังหน้าแรก ----------
   * frame: กรอบพื้นที่หน้าแรก · t: วินาที · o.enter 0–1 (สีแผ่ออกตอนเปิด) · o.still: ภาพนิ่ง (Reduced Motion)
   * o.pointer: [x, y, รัศมี, ความแรง] จุดสีตามเมาส์/นิ้ว (พิกัดในกรอบ 0–1) */
  function hero(frame, t, size, o) {
    o = o || {};
    var still = !!o.still, enter = o.enter == null ? 1 : o.enter;
    var tall = portrait(frame);
    var drift = still ? 0 : 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 48);
    var breathe = still ? 0 : Math.sin(t * Math.PI * 2 / 9.5);
    var ar = frame[2] / frame[3];
    var img, seeds, u;
    var k = clamp(enter, 0, 1), ke = k * k * (3 - 2 * k);
    var grow = (0.12 + 0.88 * ke) * (1 + 0.025 * breathe);
    function circ(x, y, r, squash) { return [x, y, r * grow, r * grow * ar * (squash || 1)]; }   // r เป็นสัดส่วนความกว้างกรอบ
    if (tall) {
      // มือถือแนวตั้ง: ข้อความอยู่บน · สีอยู่ล่างด้านหลังประติมากรรม
      img = cover(frame, size, 0.66 + 0.03 * drift, 0.5, 1.04 + 0.04 * drift);
      seeds = [circ(0.56, 0.86, 0.56, 0.9), circ(0.97, 0.64, 0.24), circ(0.08, 0.99, 0.26)];
      u = base(frame, img, t, colors(o.paper));
      u.veil = [0, 1, 0.34, 0.6]; u.veilAmt = 0.9; u.bottom = 0;
    } else {
      img = cover(frame, size, 0.60 + 0.02 * drift, 0.40, 1.04 + 0.035 * drift);
      seeds = [circ(0.73, 0.52, 0.27, 0.84), circ(0.93, 0.3, 0.13), circ(0.58, 0.82, 0.11)];
      u = base(frame, img, t, colors(o.paper));
      u.veil = [1, 0, 0.16, 0.5]; u.veilAmt = 0.9; u.bottom = 0.15;
    }
    if (k <= 0.001) seeds = [];
    if (o.pointer && o.pointer[3] > 0.001) {
      var p = o.pointer;
      seeds.push([p[0], p[1], p[2] * p[3], p[2] * p[3] * ar]);
    }
    if (o.tap) seeds.push(o.tap);
    u.seeds = seeds;
    u.wash = u.colors.dark ? 0.16 : 0.1;
    if (u.colors.dark) u.colors.bright = 0.76;                    // โหมดมืด: ภาพหลังประติมากรรมหรี่ลงอีกนิด ไม่แย่งสายตา
    u.rim = 0.35;

    u.clouds = still ? 0 : 0.05;
    u.grain = still ? 0 : 0.014;
    return u;
  }

  /* ---------- ค่ากึ่งกลางระหว่างท่าฉากเข้าเว็บ a กับท่าหน้าแรก b ----------
   * kGeo: ภาพ/กรอบเลื่อนเข้าที่ · kIn: วงสีของฉากเข้าเว็บไหลกลับไปรวมเป็นวงหลักของหน้าแรก · kVeil: ม่านกระดาษ
   * (ไม่หดวงสีเข้าหาจุดของตัวเอง เพราะจะเหลือเป็นจุดเล็ก ๆ หลายจุดก่อนหายไป) */
  function mixPose(a, b, kGeo, kIn, kVeil) {
    function L(x, y, k) { return x + (y - x) * k; }
    function LA(x, y, k) { return x.map(function (v, i) { return L(v, y[i], k); }); }
    var F = LA(a.frame, b.frame, kGeo), I = LA(a.img, b.img, kGeo);
    function rel(px, py, rx, ry) { return [(px - F[0]) / F[2], (py - F[1]) / F[3], rx / F[2], ry / F[3]]; }
    var heroPx = b.seeds.map(function (s) {
      return [b.frame[0] + s[0] * b.frame[2], b.frame[1] + s[1] * b.frame[3], s[2] * b.frame[2], s[3] * b.frame[3]];
    });
    var target = heroPx[0] || [F[0] + F[2] * 0.7, F[1] + F[3] * 0.5, 0, 0];
    var seeds = a.seeds.map(function (s) {
      var px = s[4] == null ? a.frame[0] + s[0] * a.frame[2] : I[0] + I[2] * s[4];
      var py = s[5] == null ? a.frame[1] + s[1] * a.frame[3] : I[1] + I[3] * s[5];
      return rel(L(px, target[0], kIn), L(py, target[1], kIn), L(s[2] * a.frame[2], target[2], kIn), L(s[3] * a.frame[3], target[3], kIn));
    });
    heroPx.forEach(function (h) { seeds.push(rel(h[0], h[1], h[2], h[3])); });
    return {
      frame: F, img: I, time: b.time,
      ghost: 1, reveal: 1, seeds: seeds.slice(0, SEEDS),
      edge: L(a.edge, b.edge, kGeo), warp: L(a.warp, b.warp, kGeo), feather: L(a.feather, b.feather, kGeo),
      soft: L(a.soft, b.soft, kGeo), rim: L(a.rim, b.rim, kGeo),
      wash: b.wash * kVeil, veil: b.veil, veilAmt: b.veilAmt * kVeil, bottom: b.bottom * kVeil,
      sweep: -1, clouds: b.clouds, grain: L(a.grain, b.grain, kGeo),
      colors: Object.assign({}, b.colors, { bright: L(a.colors.bright, b.colors.bright, kVeil), sat: L(a.colors.sat, b.colors.sat, kVeil) })
    };
  }

  window.LVCCampus = {
    SEEDS: SEEDS, INTRO: INTRO,
    create: create, intro: intro, hero: hero, mix: mixPose,
    cover: cover, colors: colors, loadImage: loadImage, noWebGL: noWebGL
  };
})();
