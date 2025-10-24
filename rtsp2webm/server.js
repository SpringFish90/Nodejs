import express from "express";
import { spawn } from "child_process";

const app = express();
const PORT = 38887;

// ✅ 여러 RTSP 카메라 주소 정의
const STREAMS = [
  "rtsp://210.99.70.120:1935/live/cctv001.stream",
  "rtsp://210.99.70.120:1935/live/cctv002.stream",
  "rtsp://210.99.70.120:1935/live/cctv003.stream",
  "rtsp://210.99.70.120:1935/live/cctv004.stream",
  "rtsp://210.99.70.120:1935/live/cctv005.stream",
  "rtsp://210.99.70.120:1935/live/cctv006.stream"
];

// 정적 파일(index.html)
app.use(express.static("."));

// CORS 허용
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// ✅ WebM HTTP 스트리밍 엔드포인트
app.get("/live", (req, res) => {
  const camIndex = Number(req.query.cam ?? 0) | 0;
  const RTSP_URL = STREAMS[camIndex] ?? STREAMS[0];

  console.log(`🎥 Start WebM stream → cam${camIndex}: ${RTSP_URL}`);

  // 응답 헤더 설정
  res.setHeader("Content-Type", "video/webm");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ffmpegPath = "ffmpeg"; // PATH 등록 안 되어 있으면 절대경로로 변경
  const ffmpeg = spawn(ffmpegPath, [
    "-rtsp_transport", "tcp",
    "-i", RTSP_URL,
    "-fflags", "+genpts+discardcorrupt",
    "-c:v", "libvpx", // WebM 비디오 코덱
    "-b:v", "1000k",
    "-deadline", "realtime",
    "-speed", "8",
    "-g", "30",
    "-an",
    "-f", "webm",
    "-"
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (data) => {
    const msg = data.toString();
    if (!/frame=\s*\d+/.test(msg)) console.log("[ffmpeg]", msg.trim());
  });

  const closeAll = (reason) => {
    console.log(`🔚 Stream closed (${reason})`);
    try { ffmpeg.kill("SIGINT"); } catch {}
    try { res.end(); } catch {}
  };

  req.on("close", () => closeAll("client closed"));
  req.on("aborted", () => closeAll("client aborted"));
  ffmpeg.on("close", (code) => closeAll(`ffmpeg exited ${code}`));
});

app.listen(PORT, () => {
  console.log(`✅ WebM HTTP 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   예) http://localhost:${PORT}/live?cam=0`);
});
