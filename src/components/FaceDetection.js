import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceDetection = () => {
  const videoRef = useRef();
  const canvasRef = useRef();  const [blinkCount, setBlinkCount] = useState(0);
  const [currentEAR, setCurrentEAR] = useState(0);
  const [headVerification, setHeadVerification] = useState({
    left: false,
    right: false
  });
  const headVerificationRef = useRef({
    left: false,
    right: false
  });
  const [currentHeadTilt, setCurrentHeadTilt] = useState(0);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [message, setMessage] = useState('Please blink twice (0/2)');
  const [lastBlinkTime, setLastBlinkTime] = useState(0);
  const [blinkStatus, setBlinkStatus] = useState('EYES OPEN');
  const [debugInfo, setDebugInfo] = useState('');
  const blinkCooldown = 1000; // Reduced cooldown for better responsiveness
  const blinkDoneRef = useRef(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        startVideo();
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error('Error accessing webcam:', err));
  };

  const handleVideoPlay = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    canvas.width = video.width;
    canvas.height = video.height;

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);    const interval = setInterval(async () => {
      if (!video || !canvas) return;

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

      if (detections && detections.length > 0) {        // Get landmarks for the first face
        const landmarks = detections[0].landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const nose = landmarks.getNose();
        const jawOutline = landmarks.getJawOutline();        // Calculate EAR for both eyes
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const averageEAR = (leftEAR + rightEAR) / 2.0;
        
        setCurrentEAR(averageEAR);
        const isBlinking = averageEAR < 0.280;
        
        // Update blink status immediately
        setBlinkStatus(isBlinking ? 'BLINK DETECTED' : 'EYES OPEN');        // Debug information
        context.font = '16px Arial';
        context.fillStyle = '#000000';
        context.fillText(`Current EAR: ${averageEAR.toFixed(3)} (Threshold: 0.290)`, 10, canvas.height - 60);
        context.fillText(`Left Eye: ${leftEAR.toFixed(3)} | Right Eye: ${rightEAR.toFixed(3)}`, 10, canvas.height - 40);
        context.fillText(`Status: ${averageEAR < 0.290 ? 'BLINK DETECTED' : 'EYES OPEN'}`, 10, canvas.height - 20);
          const currentTime = Date.now();          // Blink detection with immediate counter update
          if (averageEAR < 0.290 && !eyesClosed && currentTime - lastBlinkTime > blinkCooldown) {
            setEyesClosed(true);
            setLastBlinkTime(currentTime);
            setBlinkCount(prevCount => {
              if (prevCount < 2) {
                const newCount = prevCount + 1;
                if (newCount === 2) {
                  setMessage('Blink verification complete! Now turn your head left');
                  blinkDoneRef.current = true;
                } else {
                  setMessage(`Please blink twice (${newCount}/2)`);
                }
                return newCount;
              }
              return prevCount;
            });
          } else if (averageEAR >= 0.290 && eyesClosed) {
            setEyesClosed(false);
          }

        // Head movement detection (after blink verification)
        if ((blinkCount === 2 || blinkDoneRef.current) && !verificationComplete) {
          const jawCenter = jawOutline[8];
          const noseTop = nose[0];
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          // Validate landmarks exist
          if (!jawCenter || !noseTop || !leftEye || !rightEye) {
            console.log('Face landmarks not detected clearly');
            return;
          }

          // Calculate head tilt using eye positions for more accurate detection
          const leftEyeCenter = {
            x: leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length,
            y: leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length
          };
          const rightEyeCenter = {
            x: rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length,
            y: rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length
          };

          // Calculate the angle between eyes and horizontal line
          const eyeAngle = Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x);
          const headTilt = Math.sin(eyeAngle);
          
          // Update current head tilt state and debug info
          setCurrentHeadTilt(headTilt);
          setDebugInfo(`Tilt: ${headTilt.toFixed(3)} | Left: ${headVerificationRef.current.left} | Right: ${headVerificationRef.current.right}`);

          // Debug: show head tilt value on canvas and log to console
          context.font = '16px Arial';
          context.fillStyle = '#000000';
          context.fillText(`Head Tilt: ${headTilt.toFixed(3)}`, 10, canvas.height - 80);
          context.fillText(`Debug: ${debugInfo}`, 10, canvas.height - 60);
          console.log('Head Tilt:', headTilt, 'States:', headVerificationRef.current);

          // Check for left tilt first
          if (!headVerificationRef.current.left && headTilt < -0.10) {
            console.log('Left tilt detected:', headTilt);
            headVerificationRef.current.left = true;
            setHeadVerification(prev => ({ ...prev, left: true }));
            setMessage('Great! Now turn your head right');
          }
          
          // Only check for right tilt after left is verified
          if (headVerificationRef.current.left && !headVerificationRef.current.right) {
            console.log('Checking right tilt, current tilt:', headTilt);
            if (headTilt > 0.10) {
              console.log('Right tilt detected:', headTilt);
              headVerificationRef.current.right = true;
              setHeadVerification(prev => ({ ...prev, right: true }));
              setMessage('Verification complete! All steps passed successfully.');
              setVerificationComplete(true);
            } else {
              const tiltMessage = `Turn your head right (Current tilt: ${headTilt.toFixed(3)})`;
              console.log(tiltMessage);
              setMessage(tiltMessage);
            }
          }
        }        // Draw status text with more detailed information
        context.font = '24px Arial';
        context.fillStyle = '#000000';
        context.fillText(message, 10, 30);
        context.font = '16px Arial';
        context.fillText(`Current Tilt: ${currentHeadTilt.toFixed(3)}`, 10, 60);
        context.fillText(`Left Verified: ${headVerificationRef.current.left}`, 10, 90);
        context.fillText(`Right Verified: ${headVerificationRef.current.right}`, 10, 120);
      }
    }, 100);

    return () => clearInterval(interval);
  };  const calculateEAR = (eye) => {
    try {
      // Vertical distances
      const p2_p6 = euclideanDistance(eye[1], eye[5]);
      const p3_p5 = euclideanDistance(eye[2], eye[4]);
      
      // Horizontal distance
      const p1_p4 = euclideanDistance(eye[0], eye[3]);
      
      if (p1_p4 === 0) return 0.35; // Return default open eye value if horizontal distance is 0
      
      // Calculate EAR with additional vertical point averaging
      const ear = (p2_p6 + p3_p5) / (2.0 * p1_p4);
      
      // Clamp the EAR value to reasonable ranges
      return Math.min(Math.max(ear, 0.1), 0.45);
    } catch (error) {
      console.error('Error calculating EAR:', error);
      return 0.35; // Return default open eye value on error
    }
  };

  const euclideanDistance = (point1, point2) => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  };  return (
    <div style={{ position: 'relative' }}>
      <div style={{ 
        position: 'absolute', 
        top: '-120px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '10px 20px',
          borderRadius: '5px',
          color: '#fff',
          fontWeight: 'bold'
        }}>
          {message}
        </div>
        <div style={{
          background: blinkStatus === 'BLINK DETECTED' ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          padding: '10px 20px',
          borderRadius: '5px',
          color: '#000',
          fontWeight: 'bold'
        }}>
          EAR: {currentEAR.toFixed(3)} | Status: {blinkStatus} | Blinks: {blinkCount}/2
        </div>
      </div>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        background: blinkCount === 2 ? '#4CAF50' : '#222',
        color: '#fff',
        padding: '10px 30px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '1.2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        Blinks: {blinkCount}/2
      </div>
      <video
        ref={videoRef}
        width="720"
        height="560"
        autoPlay
        muted
        onPlay={handleVideoPlay}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: '-40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '20px'
      }}>
        {/* Blink counter removed for reimplementation */}
        <div style={{
          padding: '5px 15px',
          borderRadius: '15px',
          background: headVerification.left ? '#4CAF50' : '#666',
          color: 'white'
        }}>
          Head Left
        </div>
        <div style={{
          padding: '5px 15px',
          borderRadius: '15px',
          background: headVerification.right ? '#4CAF50' : '#666',
          color: 'white'
        }}>
          Head Right
        </div>
      </div>
    </div>
  );
};

export default FaceDetection;
