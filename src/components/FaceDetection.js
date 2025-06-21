import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { 
  generateFaceVector, 
  storeFaceVector, 
  storeFaceVectorWithWallet, 
  checkExistingFaceVector 
} from '../utils/faceVerification';

const FaceDetection = ({ walletAddress, onVerificationComplete }) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [blinkCount, setBlinkCount] = useState(0);
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
  const blinkCooldown = 1000;
  const blinkDoneRef = useRef(false);
  // eslint-disable-next-line no-unused-vars
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const detectionIntervalRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [videoDimensions] = useState({ width: 720, height: 560 });

  // Load models and start video
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

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle video stream
  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: videoDimensions.width },
        height: { ideal: videoDimensions.height }
      } 
    })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video starts playing
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      })
      .catch(err => {
        console.error('Error accessing webcam:', err);
        setVerificationError('Error accessing webcam. Please ensure you have granted camera permissions.');
      });
  };

  // Setup face detection
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const handleVideoPlay = () => {
      console.log('Video started playing');
      canvas.width = videoDimensions.width;
      canvas.height = videoDimensions.height;
    };

    video.addEventListener('play', handleVideoPlay);
    video.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded');
      video.play().catch(err => {
        console.error('Error playing video after metadata loaded:', err);
      });
    });

    const detectFaces = async () => {
      if (!video || !canvas || video.readyState !== 4) {
        console.log('Video not ready:', video?.readyState);
        return;
      }

      try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, {
          width: videoDimensions.width,
          height: videoDimensions.height
        });

        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        if (detections && detections.length > 0) {
          const landmarks = detections[0].landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const nose = landmarks.getNose();
          const jawOutline = landmarks.getJawOutline();

          const leftEAR = calculateEAR(leftEye);
          const rightEAR = calculateEAR(rightEye);
          const averageEAR = (leftEAR + rightEAR) / 2.0;
          
          if (Math.abs(currentEAR - averageEAR) > 0.01) {
            setCurrentEAR(averageEAR);
          }

          const isBlinking = averageEAR < 0.280;
          const currentTime = Date.now();
          
          if (isBlinking !== (blinkStatus === 'BLINK DETECTED')) {
            setBlinkStatus(isBlinking ? 'BLINK DETECTED' : 'EYES OPEN');
          }

          // Debug information
          context.font = '16px Arial';
          context.fillStyle = '#000000';
          context.fillText(`Current EAR: ${averageEAR.toFixed(3)} (Threshold: 0.290)`, 10, canvas.height - 60);
          context.fillText(`Left Eye: ${leftEAR.toFixed(3)} | Right Eye: ${rightEAR.toFixed(3)}`, 10, canvas.height - 40);
          context.fillText(`Status: ${isBlinking ? 'BLINK DETECTED' : 'EYES OPEN'}`, 10, canvas.height - 20);

          // Blink detection
          if (isBlinking && !eyesClosed && currentTime - lastBlinkTime > blinkCooldown) {
            setEyesClosed(true);
            setLastBlinkTime(currentTime);
            setBlinkCount(prevCount => {
              const newCount = Math.min(prevCount + 1, 2);
              if (newCount === 2) {
                setMessage('Blink verification complete! Now turn your head left');
                blinkDoneRef.current = true;
              } else {
                setMessage(`Please blink twice (${newCount}/2)`);
              }
              return newCount;
            });
          } else if (!isBlinking && eyesClosed) {
            setEyesClosed(false);
          }

          // Head movement detection
          if ((blinkCount === 2 || blinkDoneRef.current) && !verificationComplete) {
            const jawCenter = jawOutline[8];
            const noseTop = nose[0];

            if (!jawCenter || !noseTop || !leftEye || !rightEye) {
              return;
            }

            const leftEyeCenter = {
              x: leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length,
              y: leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length
            };
            const rightEyeCenter = {
              x: rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length,
              y: rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length
            };

            const eyeAngle = Math.atan2(rightEyeCenter.y - leftEyeCenter.y, rightEyeCenter.x - leftEyeCenter.x);
            const headTilt = Math.sin(eyeAngle);
            
            if (Math.abs(currentHeadTilt - headTilt) > 0.01) {
              setCurrentHeadTilt(headTilt);
            }

            const newDebugInfo = `Tilt: ${headTilt.toFixed(3)} | Left: ${headVerificationRef.current.left} | Right: ${headVerificationRef.current.right}`;
            if (newDebugInfo !== debugInfo) {
              setDebugInfo(newDebugInfo);
            }

            context.font = '16px Arial';
            context.fillStyle = '#000000';
            context.fillText(`Head Tilt: ${headTilt.toFixed(3)}`, 10, canvas.height - 80);
            context.fillText(`Debug: ${newDebugInfo}`, 10, canvas.height - 60);

            if (!headVerificationRef.current.left && headTilt < -0.10) {
              headVerificationRef.current.left = true;
              setHeadVerification(prev => ({ ...prev, left: true }));
              setMessage('Great! Now turn your head right');
            }
            
            if (headVerificationRef.current.left && !headVerificationRef.current.right && headTilt > 0.10) {
              headVerificationRef.current.right = true;
              setHeadVerification(prev => ({ ...prev, right: true }));
              setMessage('Verification complete! Storing face data...');
              setVerificationComplete(true);
              
              // Call handleVerificationComplete when verification is done
              handleVerificationComplete();
            } else if (headVerificationRef.current.left && !headVerificationRef.current.right) {
              setMessage(`Turn your head right (Current tilt: ${headTilt.toFixed(3)})`);
            }
          }

          // Draw status text
          context.font = '24px Arial';
          context.fillStyle = '#000000';
          context.fillText(message, 10, 30);
          context.font = '16px Arial';
          context.fillText(`Current Tilt: ${currentHeadTilt.toFixed(3)}`, 10, 60);
          context.fillText(`Left Verified: ${headVerificationRef.current.left}`, 10, 90);
          context.fillText(`Right Verified: ${headVerificationRef.current.right}`, 10, 120);
        }
      } catch (error) {
        console.error('Error in face detection:', error);
      }
    };

    detectionIntervalRef.current = setInterval(detectFaces, 100);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      video.removeEventListener('play', handleVideoPlay);
      video.removeEventListener('loadedmetadata', () => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEAR, blinkStatus, eyesClosed, lastBlinkTime, blinkCount, verificationComplete, debugInfo, message, videoDimensions]);

  const calculateEAR = (eye) => {
    try {
      const p2_p6 = euclideanDistance(eye[1], eye[5]);
      const p3_p5 = euclideanDistance(eye[2], eye[4]);
      const p1_p4 = euclideanDistance(eye[0], eye[3]);
      
      if (p1_p4 === 0) return 0.35;
      
      const ear = (p2_p6 + p3_p5) / (2.0 * p1_p4);
      return Math.min(Math.max(ear, 0.1), 0.45);
    } catch (error) {
      console.error('Error calculating EAR:', error);
      return 0.35;
    }
  };

  const euclideanDistance = (point1, point2) => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  };

  const handleVerificationComplete = async () => {
    try {
      setMessage('Generating face vector...');
      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        throw new Error('No face detected');
      }

      setMessage('Checking for existing verification...');
      setIsCheckingExisting(true);
      
      const faceVector = generateFaceVector(detections[0]);
      
      // Check if this face already exists in the database
      const existingFace = await checkExistingFaceVector(faceVector);
      
      if (existingFace) {
        // This face has already been verified before
        const similarityPercent = Math.round(existingFace.similarity * 100);
        const message = `This face has already been verified (${similarityPercent}% match).`;
        console.log('Existing face details:', existingFace);
        
        setMessage(message);
        setVerificationError(message);
        return;
      }
      
      setMessage('Storing face data...');
      try {
        let stored = false;
        
        // If we have a wallet address, store with it
        if (walletAddress) {
          stored = await storeFaceVectorWithWallet(faceVector, walletAddress);
        } else {
          // Fallback to regular storage
          stored = await storeFaceVector(faceVector);
        }
        
        if (!stored) {
          console.warn('Face vector storage skipped (Firebase might not be available)');
        }
      } catch (error) {
        console.warn('Face vector storage failed:', error);
        // Continue with verification even if storage fails
      }
      
      setMessage('Verification complete!');
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError(error.message);
    } finally {
      setIsCheckingExisting(false);
    }
  };

  // Helper for progress bar
  const getProgress = () => {
    if (!headVerification.left && !headVerification.right) return 0.33;
    if (headVerification.left && !headVerification.right) return 0.66;
    if (headVerification.left && headVerification.right) return 1;
    return 0;
  };

  return (
    <div className="face-detection-outer">
      {/* Status/Error/Progress above video */}
      <div className="face-info-top">
        {/* Only show status if there is no error */}
        {!verificationError && message && <div className="status-overlay">{message}</div>}
        {verificationError && <div className="error-message">{verificationError}</div>}
        <div className="progress-bar">
          <div className="progress-bar-inner" style={{ width: `${getProgress() * 100}%` }} />
        </div>
      </div>

      {/* Video/Canvas area only */}
      <div className="face-canvas-area">
        <video
          ref={videoRef}
          width={videoDimensions.width}
          height={videoDimensions.height}
          autoPlay
          muted
          playsInline
          className="face-video"
        />
        <canvas
          ref={canvasRef}
          width={videoDimensions.width}
          height={videoDimensions.height}
          className="face-canvas"
        />
      </div>

      {/* Info/Controls below video */}
      <div className="face-info-bottom">
        <div className="debug-info">
          {`Current Tilt: ${currentHeadTilt.toFixed(3)}\nLeft Verified: ${headVerification.left}\nRight Verified: ${headVerification.right}\nCurrent EAR: ${currentEAR.toFixed(3)} (Threshold: 0.290)\nStatus: ${blinkStatus}\n${debugInfo}`}
        </div>
        <div className="head-indicators">
          <div className={`head-badge${headVerification.left ? ' active' : ''}`}>Head Left</div>
          <div className={`head-badge${headVerification.right ? ' active' : ''}`}>Head Right</div>
        </div>
      </div>
    </div>
  );
};

export default FaceDetection;
