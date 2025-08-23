// galaxy-component.js
// 使用方式：在 HTML 引入這支檔案後，直接 <galaxy-canvas ...></galaxy-canvas>

import { Renderer, Program, Mesh, Color, Triangle } from 'https://unpkg.com/ogl?module';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0., 1.);
}
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform bool uTransparent;
varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float tri(float x){return abs(fract(x)*2. - 1.);}
float tris(float x){float t=fract(x);return 1.-smoothstep(0.,1.,abs(2.*t-1.));}
float trisn(float x){float t=fract(x);return 2.*(1.-smoothstep(0.,1.,abs(2.*t-1.)))-1.;}
vec3 hsv2rgb(vec3 c){
  vec4 K=vec4(1.,2./3.,1./3.,3.);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);
}
float Star(vec2 uv,float flare){
  float d=length(uv);
  float m=(0.05*uGlowIntensity)/d;
  float rays=smoothstep(0.,1.,1.-abs(uv.x*uv.y*1000.));
  m+=rays*flare*uGlowIntensity;
  uv*=MAT45;
  rays=smoothstep(0.,1.,1.-abs(uv.x*uv.y*1000.));
  m+=rays*0.3*flare*uGlowIntensity;
  m*=smoothstep(1.,0.2,d);
  return m;
}
vec3 StarLayer(vec2 uv){
  vec3 col=vec3(0.);
  vec2 gv=fract(uv)-0.5;
  vec2 id=floor(uv);
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 offset=vec2(float(x),float(y));
      vec2 si=id+offset;
      float seed=Hash21(si);
      float size=fract(seed*345.32);
      float glossLocal=tri(uStarSpeed/(PERIOD*seed+1.));
      float flareSize=smoothstep(0.9,1.,size)*glossLocal;

      float red=smoothstep(STAR_COLOR_CUTOFF,1.,Hash21(si+1.))+STAR_COLOR_CUTOFF;
      float blu=smoothstep(STAR_COLOR_CUTOFF,1.,Hash21(si+3.))+STAR_COLOR_CUTOFF;
      float grn=min(red,blu)*seed;
      vec3 base=vec3(red,grn,blu);

      float hue=atan(base.g-base.r,base.b-base.r)/(2.*3.14159)+0.5;
      hue=fract(hue+uHueShift/360.);
      float sat=length(base-vec3(dot(base,vec3(0.299,0.587,0.114))))*uSaturation;
      float val=max(max(base.r,base.g),base.b);
      base=hsv2rgb(vec3(hue,sat,val));

      vec2 pad=vec2(tris(seed*34.+uTime*uSpeed/10.),tris(seed*38.+uTime*uSpeed/30.))-0.5;
      float star=Star(gv-offset-pad,flareSize);
      vec3 color=base;

      float twinkle=trisn(uTime*uSpeed+seed*6.2831)*0.5+1.;
      twinkle=mix(1.,twinkle,uTwinkleIntensity);
      star*=twinkle;

      col+=star*size*color;
    }
  }
  return col;
}
void main(){
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv=(vUv*uResolution.xy - focalPx)/uResolution.y;

  vec2 mouseNorm=uMouse-vec2(0.5);
  if(uAutoCenterRepulsion>0.){
    vec2 centerUV=vec2(0.,0.);
    float centerDist=length(uv-centerUV);
    vec2 repulsion=normalize(uv-centerUV)*(uAutoCenterRepulsion/(centerDist+0.1));
    uv+=repulsion*0.05;
  }else if(uMouseRepulsion){
    vec2 mousePosUV=(uMouse*uResolution.xy - focalPx)/uResolution.y;
    float mouseDist=length(uv-mousePosUV);
    vec2 repulsion=normalize(uv-mousePosUV)*(uRepulsionStrength/(mouseDist+0.1));
    uv+=repulsion*0.05*uMouseActiveFactor;
  }else{
    vec2 mouseOffset=mouseNorm*0.1*uMouseActiveFactor;
    uv+=mouseOffset;
  }

  float autoRotAngle=uTime*uRotationSpeed;
  mat2 autoRot=mat2(cos(autoRotAngle),-sin(autoRotAngle),sin(autoRotAngle),cos(autoRotAngle));
  uv=autoRot*uv;

  uv=mat2(uRotation.x,-uRotation.y,uRotation.y,uRotation.x)*uv;

  vec3 col=vec3(0.);
  for(float i=0.; i<1.; i+=1./NUM_LAYER){
    float depth=fract(i+uStarSpeed*uSpeed);
    float scale=mix(20.*uDensity,0.5*uDensity,depth);
    float fade=depth*smoothstep(1.,0.9,depth);
    col+=StarLayer(uv*scale + i*453.32)*fade;
  }

  if(uTransparent){
    float alpha=length(col);
    alpha=smoothstep(0.,0.3,alpha);
    alpha=min(alpha,1.);
    gl_FragColor=vec4(col,alpha);
  }else{
    gl_FragColor=vec4(col,1.);
  }
}
`;

const defaults = {
  focal: [0.5, 0.5],
  rotation: [1.0, 0.0],
  starSpeed: 0.5,
  density: 1,
  hueShift: 140,
  disableAnimation: false,
  speed: 1.0,
  mouseInteraction: true,
  glowIntensity: 0.3,
  saturation: 0.0,
  mouseRepulsion: true,
  repulsionStrength: 2,
  twinkleIntensity: 0.3,
  rotationSpeed: 0.1,
  autoCenterRepulsion: 0,
  transparent: true,
  paused: false
};

// HTML attribute <-> option 名稱對應（kebab -> camel）
const attrMap = {
  focal: 'focal',                   // "0.5,0.5"
  rotation: 'rotation',             // "1,0"
  'star-speed': 'starSpeed',
  density: 'density',
  'hue-shift': 'hueShift',
  'disable-animation': 'disableAnimation',
  speed: 'speed',
  'mouse-interaction': 'mouseInteraction',
  'glow-intensity': 'glowIntensity',
  saturation: 'saturation',
  'mouse-repulsion': 'mouseRepulsion',
  'repulsion-strength': 'repulsionStrength',
  'twinkle-intensity': 'twinkleIntensity',
  'rotation-speed': 'rotationSpeed',
  'auto-center-repulsion': 'autoCenterRepulsion',
  transparent: 'transparent',
  paused: 'paused'
};

function parseBool(v, def) {
  if (v == null) return def;
  const s = String(v).toLowerCase().trim();
  if (s === '' || s === 'true') return true;
  if (s === 'false') return false;
  return def;
}
function parseNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function parseVec2(v, def) {
  if (!v) return def;
  const parts = String(v).split(',').map(s => Number(s.trim()));
  return (parts.length === 2 && parts.every(Number.isFinite)) ? parts : def;
}

class GalaxyCanvas extends HTMLElement {
  static get observedAttributes() {
    return Object.keys(attrMap);
  }

  constructor() {
    super();
    this._options = { ...defaults };
    // 記錄「使用者手動暫停」狀態，避免跟可見性/IO 互相搶控制
    this._userPaused = false;
    this._shadow = this.attachShadow({ mode: 'open' });
    this._wrap = document.createElement('div');
    Object.assign(this._wrap.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    });
    this._shadow.appendChild(this._wrap);

    this._renderer = null;
    this._gl = null;
    this._program = null;
    this._mesh = null;
    this._animId = null;

    this._targetMouse = { x: 0.5, y: 0.5 };
    this._smoothMouse = { x: 0.5, y: 0.5 };
    this._targetActive = 0.0;
    this._smoothActive = 0.0;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onResize = this._onResize.bind(this);
    this._resizeObs = new ResizeObserver(() => this._onResize());
  }
//new
    // 讓你可以用 JS 設定 options：el.options = {...}
    get options() { return { ...this._options }; }
    set options(next) {
      this._applyOptions(next);
    }
    get paused() { return this._options.paused; }
    set paused(v) {
      const val = parseBool(v, this._options.paused);
      if (val !== this._options.paused) {
        this._options.paused = val;
        this._userPaused = val; // 使用者手動設定
        if (val) this.pause(); else this.play();
      }
    }
//new    

    // 現有 stop()/start() 很好，我別名成 pause()/play() 會更語意化
    pause() { this.stop(); }
    play()  { this.start(); }

  connectedCallback() {
    // 預設大小（若頁面沒指定）
    if (getComputedStyle(this).display === 'inline') this.style.display = 'block';
    if (!this.style.height) this.style.height = '600px';

    // 從屬性讀進 options
    this._readAttributes();

    // 啟動
    this._initGL();
    this._resizeObs.observe(this);
    if (this._options.mouseInteraction) {
      this._wrap.addEventListener('mousemove', this._onMouseMove);
      this._wrap.addEventListener('mouseleave', this._onMouseLeave);
    }
    // --- [E] 可見性自動省電：切到背景分頁時暫停，回來恢復 ---
    this._onVisibility = () => {
      if (document.hidden) {
        this.stop();
      } else if (!this._options.paused && !this._userPaused) {
        this.start();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    
    // 如果一開始就 paused，就不啟動 loop
    if (!this._options.paused) {
    this._loop(0);
  }
  }

  disconnectedCallback() {
    this.destroy();
  }

  attributeChangedCallback(name, oldV, newV) {
    if (oldV === newV) return;
    const key = attrMap[name];
    let changed = {};

    switch (key) {
      case 'focal':
        changed.focal = parseVec2(newV, this._options.focal);
        break;
      case 'rotation':
        changed.rotation = parseVec2(newV, this._options.rotation);
        break;
      case 'disableAnimation':
      case 'mouseInteraction':
      case 'mouseRepulsion':
      case 'transparent':
        changed[key] = parseBool(newV, this._options[key]);
        break;
      // --- [F] 新增 paused 的屬性處理 ---
      case 'paused': {
        const val = parseBool(newV, this._options.paused);
        this._userPaused = val;
        this._options.paused = val;
        if (val) this.pause(); else this.play();
        return; // 已處理完，直接 return
      }
      default:
        // 數值
        changed[key] = parseNum(newV, this._options[key]);
    }
    this._applyOptions(changed);
  }

  // 公開方法：停止/啟動/摧毀
  stop() {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }
  start() {
    if (!this._animId) this._loop(performance.now());
  }
  destroy() {
    this.stop();
    this._resizeObs.disconnect();
    this._wrap.removeEventListener('mousemove', this._onMouseMove);
    this._wrap.removeEventListener('mouseleave', this._onMouseLeave);

    // --- 移除可見性監聽 ---
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._onVisibility = null;
    }

    if (this._mesh) this._mesh = null;
    if (this._renderer) {
      const gl = this._gl;
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
      // 移除 canvas
      if (gl && gl.canvas && gl.canvas.parentNode) {
        gl.canvas.parentNode.removeChild(gl.canvas);
      }
    }
    this._renderer = null;
    this._gl = null;
    this._program = null;
  }

  // 內部：從屬性載入
  _readAttributes() {
    const o = {};
    for (const [attr, key] of Object.entries(attrMap)) {
      const v = this.getAttribute(attr);
      if (v == null) continue;
      switch (key) {
        case 'focal': o.focal = parseVec2(v, defaults.focal); break;
        case 'rotation': o.rotation = parseVec2(v, defaults.rotation); break;
        case 'disableAnimation':
        case 'mouseInteraction':
        case 'mouseRepulsion':
        case 'transparent':
          o[key] = parseBool(v, defaults[key]); break;
        default:
          o[key] = parseNum(v, defaults[key]);
      }
    }
    this._options = { ...defaults, ...o };
  }

  // 內部：套用變更（盡量熱更新 uniforms；必要時重建）
  _applyOptions(next) {
    const prev = this._options;
    this._options = { ...prev, ...next };

    if (!this._program) return; // 還沒初始化

    // 需要重建 renderer 的情況（透明度混合）
    if ('transparent' in next) {
      // 重建 GL（最穩）
      const saved = { ...this._options };
      this.destroy();
      this._options = saved;
      this.connectedCallback();
      return;
    }

    // 滑鼠互動開關
    if ('mouseInteraction' in next) {
      if (this._options.mouseInteraction) {
        this._wrap.addEventListener('mousemove', this._onMouseMove);
        this._wrap.addEventListener('mouseleave', this._onMouseLeave);
      } else {
        this._wrap.removeEventListener('mousemove', this._onMouseMove);
        this._wrap.removeEventListener('mouseleave', this._onMouseLeave);
      }
    }

    // 熱更新 uniforms
    const U = this._program.uniforms;
    if ('focal' in next) U.uFocal.value = new Float32Array(this._options.focal);
    if ('rotation' in next) U.uRotation.value = new Float32Array(this._options.rotation);
    if ('starSpeed' in next) U.uStarSpeed.value = this._options.starSpeed;
    if ('density' in next) U.uDensity.value = this._options.density;
    if ('hueShift' in next) U.uHueShift.value = this._options.hueShift;
    if ('speed' in next) U.uSpeed.value = this._options.speed;
    if ('glowIntensity' in next) U.uGlowIntensity.value = this._options.glowIntensity;
    if ('saturation' in next) U.uSaturation.value = this._options.saturation;
    if ('mouseRepulsion' in next) U.uMouseRepulsion.value = this._options.mouseRepulsion;
    if ('twinkleIntensity' in next) U.uTwinkleIntensity.value = this._options.twinkleIntensity;
    if ('rotationSpeed' in next) U.uRotationSpeed.value = this._options.rotationSpeed;
    if ('repulsionStrength' in next) U.uRepulsionStrength.value = this._options.repulsionStrength;
    if ('autoCenterRepulsion' in next) U.uAutoCenterRepulsion.value = this._options.autoCenterRepulsion;
  }

  _initGL() {
    const o = this._options;

    const renderer = new Renderer({
      alpha: o.transparent,
      premultipliedAlpha: false
    });
    const gl = renderer.gl;

    if (o.transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0,0,0,0);
    } else {
      gl.clearColor(0,0,0,1);
    }

    this._wrap.appendChild(gl.canvas);
    this._renderer = renderer;
    this._gl = gl;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Color(1,1,1) },
        uFocal: { value: new Float32Array(o.focal) },
        uRotation: { value: new Float32Array(o.rotation) },
        uStarSpeed: { value: o.starSpeed },
        uDensity: { value: o.density },
        uHueShift: { value: o.hueShift },
        uSpeed: { value: o.speed },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uGlowIntensity: { value: o.glowIntensity },
        uSaturation: { value: o.saturation },
        uMouseRepulsion: { value: o.mouseRepulsion },
        uTwinkleIntensity: { value: o.twinkleIntensity },
        uRotationSpeed: { value: o.rotationSpeed },
        uRepulsionStrength: { value: o.repulsionStrength },
        uMouseActiveFactor: { value: 0.0 },
        uAutoCenterRepulsion: { value: o.autoCenterRepulsion },
        uTransparent: { value: o.transparent }
      }
    });

    this._program = program;
    this._mesh = new Mesh(gl, { geometry, program });
    this._onResize();
  }

  _onResize() {
    if (!this._renderer || !this._gl) return;
    const w = this._wrap.clientWidth || this.clientWidth || 1;
    const h = this._wrap.clientHeight || this.clientHeight || 1;
    this._renderer.setSize(w, h);
    this._program.uniforms.uResolution.value = new Color(
      this._gl.canvas.width,
      this._gl.canvas.height,
      this._gl.canvas.width / this._gl.canvas.height
    );
  }

  _onMouseMove(e) {
    const rect = this._wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    this._targetMouse.x = x;
    this._targetMouse.y = y;
    this._targetActive = 1.0;
  }
  _onMouseLeave() {
    this._targetActive = 0.0;
  }

  _loop(t) {
    this._animId = requestAnimationFrame(this._loop.bind(this));

    if (!this._program || !this._renderer) return;
    const U = this._program.uniforms;

    if (!this._options.disableAnimation) {
      U.uTime.value = t * 0.001;
      U.uStarSpeed.value = (t * 0.001 * this._options.starSpeed) / 10.0;
    }

    const k = 0.05;
    this._smoothMouse.x += (this._targetMouse.x - this._smoothMouse.x) * k;
    this._smoothMouse.y += (this._targetMouse.y - this._smoothMouse.y) * k;
    this._smoothActive += (this._targetActive - this._smoothActive) * k;

    U.uMouse.value[0] = this._smoothMouse.x;
    U.uMouse.value[1] = this._smoothMouse.y;
    U.uMouseActiveFactor.value = this._smoothActive;

    this._renderer.render({ scene: this._mesh });
  }
}

customElements.define('galaxy-canvas', GalaxyCanvas);

