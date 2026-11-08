'use strict';
/* Browser-only research harness. NEVER upload frames/descriptors.
 * This uses face-api.js models independent from Hamyar's server-side Edge.
 * Two-person distances are exploratory; NOT certified identity recognition. */
const $ = id => document.getElementById(id);
const FACE_MODEL_BASE = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js-models@master';
const MIN_SAMPLES = 3;
const EXPERIMENTAL_THRESHOLD = 0.50;
const MIN_MARGIN = 0.05;
const state = {
  loaded: false, stream: null, busy: false,
  records: { A: [], B: [] }, trials: [], lastCapture: { A: 0, B: 0 },
};
const video = $('camera');
function say(message, error=false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', !!error);
}
function filled(who) { return state.records[who].length >= MIN_SAMPLES; }
function canTest() { return filled('A') && filled('B') && state.stream && !state.busy; }
function consent(who) { return $('consent'+who).checked; }
function refresh() {
  $('loadBtn').disabled = state.busy || state.loaded;
  $('startBtn').disabled = state.busy || !state.loaded || !!state.stream;
  $('stopBtn').disabled = !state.stream;
  for (const who of ['A','B']) {
    $('count'+who).textContent = state.records[who].length + ' / ' + MIN_SAMPLES;
    $('enroll'+who).disabled = state.busy || !state.stream || !consent(who) || filled(who);
  }
  $('testBtn').disabled = !canTest() || !consent('A') || !consent('B');
  $('exportBtn').disabled = state.trials.length === 0;
  $('readyBadge').textContent = filled('A') && filled('B') ? 'آماده آزمون' : 'در انتظار نمونه‌ها';
  $('cameraBadge').textContent = state.stream ? 'دوربین روشن' : 'دوربین خاموش';
  $('totalTests').textContent = String(state.trials.length);
  $('correctTests').textContent = String(state.trials.filter(x=>x.correct).length);
  $('wrongTests').textContent = String(state.trials.filter(x=>!x.correct).length);
}
async function busyRun(action) {
  if (state.busy) return;
  state.busy = true;
  refresh();
  try { await action(); }
  catch (error) {
    console.error('Camera lab (no face data)', error?.name || 'Error');
    say('خطا: ' + (error?.message || 'مشکل نامشخص') , true);
  } finally { state.busy = false; refresh(); }
}
async function loadModels() {
  await busyRun(async () => {
    if (!window.faceapi) throw Error('کتابخانه پردازش تصویر بارگذاری نشده است؛ اتصال اینترنت را بررسی کن.');
    say('در حال دریافت سه مدل تشخیص، نقاط چهره و بردار تطبیق…');
    // Models are fetched from public CDN. NO images or descriptors are sent.
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_BASE + '/tiny_face_detector'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_BASE + '/face_landmark_68_tiny'),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_BASE + '/face_recognition'),
    ]);
    state.loaded = true;
    say('مدل‌های آزمایشی آماده شدند. حالا دوربین جلو را روشن کن.');
  });
}
async function startCamera() {
  await busyRun(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
      throw Error('برای باز کردن دوربین، لینک HTTPS را در Chrome موبایل باز کن.');
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = state.stream;
    await video.play();
    $('camHint').hidden = true;
    say('دوربین فعال است. یک نفر روبه‌روی دوربین قرار بگیرد؛ سپس ثبت را لمس کن.');
  });
}
function stopCamera() {
  const stream = state.stream;
  if (stream) stream.getTracks().forEach(track => track.stop());
  state.stream = null;
  video.srcObject = null;
  $('camHint').hidden = false;
  $('camHint').textContent = 'دوربین خاموش است؛ برای ادامه دوباره آن را روشن کن.';
  $('overlay').getContext('2d')?.clearRect(0,0,$('overlay').width,$('overlay').height);
  say('دوربین خاموش شد. نمونه‌های موقت هنوز در حافظه هستند؛ برای حذف کامل، پاک‌کردن همه نمونه‌ها را بزن.');
  refresh();
}
function average(descriptors) {
  const out = new Float32Array(descriptors[0].length);
  for (const d of descriptors) for (let i=0;i<out.length;i++) out[i] += d[i] / descriptors.length;
  return out;
}
async function describeCurrentFace() {
  if (!state.stream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
    throw Error('تصویر دوربین هنوز آماده نیست.');
  const started = performance.now();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const faces = await faceapi.detectAllFaces(video, opts).withFaceLandmarks(true).withFaceDescriptors();
  if (faces.length !== 1) throw Error(faces.length ? 'بیش از یک چهره دیده شد. فقط یک نفر در کادر باشد.' : 'چهره پیدا نشد. نور و فاصله را تنظیم کن.');
  const { box } = faces[0].detection;
  if (box.width < video.videoWidth * 0.13 || box.height < video.videoHeight * 0.13)
    throw Error('چهره کوچک است. کمی نزدیک‌تر بیا.');
  if (faces[0].detection.score < .60) throw Error('اطمینان تشخیص اولیه پایین است. نور را بیشتر کن.');
  // The raw camera frame and the descriptor are never written to disk or sent to a server.
  return { descriptor: Float32Array.from(faces[0].descriptor),
    ms: Math.round(performance.now()-started),
    detectionScore: Math.round(faces[0].detection.score*100)/100 };
}
async function enroll(who) {
  await busyRun(async () => {
    if (!consent(who)) throw Error('ابتدا رضایت داوطلب را تأیید کن.');
    if (filled(who)) throw Error('سه نمونه این داوطلب قبلاً ثبت شده است.');
    if (Date.now() - state.lastCapture[who] < 650) throw Error('بین دو تصویر کمی مکث کن.');
    say('در حال بررسی فریم داوطلب '+who+'…');
    const result = await describeCurrentFace();
    state.records[who].push(result.descriptor);
    state.lastCapture[who] = Date.now();
    say('نمونه '+state.records[who].length+' از '+MIN_SAMPLES+' برای داوطلب '+who+' در حافظه موقت ثبت شد. زمان پردازش: '+result.ms+' میلی‌ثانیه.');
  });
}
async function testFrame() {
  await busyRun(async () => {
    if (!filled('A') || !filled('B') || !consent('A') || !consent('B')) throw Error('ابتدا ثبت سه نمونه و رضایت هر دو داوطلب را کامل کن.');
    say('در حال تطبیق همین تصویر با دو نمونه ثبت‌شده…');
    const result = await describeCurrentFace();
    const dA = faceapi.euclideanDistance(result.descriptor, average(state.records.A));
    const dB = faceapi.euclideanDistance(result.descriptor, average(state.records.B));
    const nearest = dA < dB ? 'A' : 'B';
    const best = Math.min(dA, dB);
    const margin = Math.abs(dA - dB);
    const guess = best <= EXPERIMENTAL_THRESHOLD && margin >= MIN_MARGIN ? nearest : 'نامشخص';
    const claimed = $('claimed').value;
    const correct = guess === claimed;
    $('scoreA').textContent = dA.toFixed(3);
    $('scoreB').textContent = dB.toFixed(3);
    $('result').className = 'result '+(correct ? 'good':'bad');
    $('result').textContent = correct
      ? '✓ تطبیق آزمایشی با داوطلب '+claimed+' هم‌خوان بود. (این نتیجه هویت‌سنجی معتبر نیست.)'
      : '✕ نتیجه با انتظار هم‌خوان نیست؛ نزدیک‌ترین نتیجه: '+guess+'. تصاویر، نور و فاصله را بررسی کن.';
    state.trials.push({
      expected: claimed, predicted: guess, correct, a: +dA.toFixed(3), b: +dB.toFixed(3),
      margin: +margin.toFixed(3), elapsedMs: result.ms,
    });
    say('آزمون '+state.trials.length+' ثبت شد. زمان محاسبه: '+result.ms+' میلی‌ثانیه.');
  });
}
function clearAll() {
  state.records.A.length = 0;
  state.records.B.length = 0;
  state.trials.length = 0;
  state.lastCapture = { A: 0, B: 0 };
  $('consentA').checked = false;
  $('consentB').checked = false;
  $('scoreA').textContent='—';
  $('scoreB').textContent='—';
  $('result').className='result';
  $('result').textContent='نمونه‌ها پاک شدند. برای شروع، رضایت هر دو داوطلب را دوباره ثبت کن.';
  say('همه نمونه‌های چهره و نتایج در حافظه صفحه پاک شدند.');
  refresh();
}
function exportReport() {
  const report = {
    purpose: 'exploratory-two-consenting-adult-camera-smoke-test-not-identity-certification',
    engine: 'browser-face-api.js-independent-of-Hamyar-Edge',
    photosStored: false, descriptorsIncluded: false,
    thresholds: {euclidean: EXPERIMENTAL_THRESHOLD, minMargin: MIN_MARGIN},
    sampleCounts: {A:state.records.A.length,B:state.records.B.length},
    trials: state.trials.map(x=>({...x})), total:state.trials.length,
    correct:state.trials.filter(x=>x.correct).length,
  };
  const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='hamyar-two-face-local-test.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
$('loadBtn').addEventListener('click',loadModels);
$('startBtn').addEventListener('click',startCamera);
$('stopBtn').addEventListener('click',stopCamera);
$('enrollA').addEventListener('click',()=>enroll('A'));
$('enrollB').addEventListener('click',()=>enroll('B'));
$('testBtn').addEventListener('click',testFrame);
$('exportBtn').addEventListener('click',exportReport);
$('resetBtn').addEventListener('click',clearAll);
for(const who of ['A','B']) $('consent'+who).addEventListener('change',()=>{
  if (!consent(who) && state.records[who].length) {
    state.records[who].length=0;
    state.trials.length=0;
    $('result').textContent='با لغو رضایت، نمونه‌های آن داوطلب و نتایج قبلی پاک شد.';
    say('رضایت داوطلب '+who+' لغو شد و داده‌های مرتبط از حافظه پاک شدند.');
  }
  refresh();
});
window.addEventListener('pagehide',()=>{
  stopCamera();
  clearAll();
});
refresh();
