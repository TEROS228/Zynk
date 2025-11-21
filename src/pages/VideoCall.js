import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'peerjs';

const VideoCall = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();

  const [myPeerId, setMyPeerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [error, setError] = useState(null);
  const [isMyVideoLarge, setIsMyVideoLarge] = useState(false);
  const [smallVideoPosition, setSmallVideoPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHost, setIsHost] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState({
    packetLoss: 0,
    rtt: 0,
    jitter: 0,
    bitrate: 0,
    quality: 'excellent' // excellent, good, poor, bad
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [remoteWhiteboardActive, setRemoteWhiteboardActive] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState('pen'); // pen, eraser
  const [isDrawing, setIsDrawing] = useState(false);

  const myVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const largeVideoRef = useRef(null);
  const smallVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const mySmallCameraRef = useRef(null);
  const remoteSmallCameraRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callRef = useRef(null);
  const dataConnRef = useRef(null);
  const dragAnimationFrameRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const userName = localStorage.getItem('userName') || 'Гость';

  // Detect mobile device (only by user agent, not screen size)
  useEffect(() => {
    const checkMobile = () => {
      // Exclude iPad and tablets - treat them as desktop
      const mobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && !/iPad/i.test(navigator.userAgent);
      setIsMobile(mobile);
      console.log('>>> Device check - isMobile:', mobile, 'userAgent:', navigator.userAgent);
    };

    checkMobile();
  }, []);

  // Show controls when cursor is at top or bottom of screen
  useEffect(() => {
    const handleMouseMove = (e) => {
      const windowHeight = window.innerHeight;
      const cursorY = e.clientY;

      // Show controls if cursor is in top 100px or bottom 100px
      if (cursorY < 100 || cursorY > windowHeight - 100) {
        setShowControls(true);
      } else {
        setShowControls(false);
      }
    };

    // Add event listener
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Sync video streams for screen sharing and whiteboard layout
  useEffect(() => {
    if (((isScreenSharing || remoteScreenSharing) || (isWhiteboardActive || remoteWhiteboardActive)) && isConnected) {
      // Set my camera to small camera ref
      if (mySmallCameraRef.current && myStreamRef.current) {
        mySmallCameraRef.current.srcObject = myStreamRef.current;
      }
      // Set remote camera to small camera ref
      if (remoteSmallCameraRef.current && remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        remoteSmallCameraRef.current.srcObject = remoteVideoRef.current.srcObject;
      }
    }
  }, [isScreenSharing, remoteScreenSharing, isWhiteboardActive, remoteWhiteboardActive, isConnected]);

  // Sync video streams to display elements (mobile only)
  useEffect(() => {
    if (!isMobile) return; // Skip for desktop layout

    console.log('>>> useEffect: Syncing video streams (mobile)');
    console.log('>>> isConnected:', isConnected);
    console.log('>>> isMyVideoLarge:', isMyVideoLarge);

    if (largeVideoRef.current) {
      if (!isConnected && myVideoRef.current) {
        largeVideoRef.current.srcObject = myVideoRef.current.srcObject;
      } else if (isConnected) {
        if (isMyVideoLarge && myVideoRef.current) {
          largeVideoRef.current.srcObject = myVideoRef.current.srcObject;
        } else if (!isMyVideoLarge && remoteVideoRef.current) {
          largeVideoRef.current.srcObject = remoteVideoRef.current.srcObject;
        }
      }
    }

    if (smallVideoRef.current && isConnected) {
      if (isMyVideoLarge && remoteVideoRef.current) {
        smallVideoRef.current.srcObject = remoteVideoRef.current.srcObject;
      } else if (!isMyVideoLarge && myVideoRef.current) {
        smallVideoRef.current.srcObject = myVideoRef.current.srcObject;
      }
    }
  }, [isConnected, isMyVideoLarge, isMobile]);

  // Monitor connection quality
  useEffect(() => {
    if (!isConnected || !callRef.current) {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      return;
    }

    const monitorStats = async () => {
      try {
        const peerConnection = callRef.current.peerConnection;
        if (!peerConnection) return;

        const stats = await peerConnection.getStats();
        let packetLoss = 0;
        let rtt = 0;
        let jitter = 0;
        let bitrate = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            // Calculate packet loss
            if (report.packetsLost && report.packetsReceived) {
              const totalPackets = report.packetsLost + report.packetsReceived;
              packetLoss = (report.packetsLost / totalPackets) * 100;
            }
            // Get jitter
            if (report.jitter) {
              jitter = report.jitter * 1000; // Convert to ms
            }
            // Calculate bitrate
            if (report.bytesReceived && report.timestamp) {
              bitrate = (report.bytesReceived * 8) / 1000; // Convert to kbps
            }
          }

          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            // Get RTT (Round Trip Time)
            if (report.currentRoundTripTime) {
              rtt = report.currentRoundTripTime * 1000; // Convert to ms
            }
          }
        });

        // Determine quality level
        let quality = 'excellent';
        if (packetLoss > 5 || rtt > 300 || jitter > 30) {
          quality = 'bad';
        } else if (packetLoss > 2 || rtt > 200 || jitter > 20) {
          quality = 'poor';
        } else if (packetLoss > 0.5 || rtt > 100 || jitter > 10) {
          quality = 'good';
        }

        setConnectionQuality({
          packetLoss: Math.round(packetLoss * 100) / 100,
          rtt: Math.round(rtt),
          jitter: Math.round(jitter * 100) / 100,
          bitrate: Math.round(bitrate),
          quality
        });
      } catch (err) {
        console.error('Error monitoring stats:', err);
      }
    };

    // Monitor every 2 seconds
    statsIntervalRef.current = setInterval(monitorStats, 2000);
    monitorStats(); // Initial call

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [isConnected]);

  useEffect(() => {
    let mounted = true;
    let connectionAttemptInterval;

    const initializeCall = async () => {
      try {
        // Get user media with optimized video and audio settings
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: { exact: true },
            noiseSuppression: { exact: true },
            autoGainControl: { exact: true },
            googEchoCancellation: { exact: true },
            googAutoGainControl: { exact: true },
            googNoiseSuppression: { exact: true },
            googHighpassFilter: { exact: true },
            googTypingNoiseDetection: { exact: true },
            sampleRate: 48000,
            channelCount: 1
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        myStreamRef.current = stream;

        // Check if mobile (excluding iPad)
        const isMobileDevice = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && !/iPad/i.test(navigator.userAgent);

        if (isMobileDevice) {
          // Mobile: set to largeVideoRef initially
          if (largeVideoRef.current) {
            largeVideoRef.current.srcObject = stream;
            console.log('>>> Initial video set to largeVideoRef (mobile)');
          }
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
            console.log('>>> Initial my video stream set (mobile hidden)');
          }
        } else {
          // Desktop: set to both largeVideoRef (for waiting) and myVideoRef (for connected)
          if (largeVideoRef.current) {
            largeVideoRef.current.srcObject = stream;
            console.log('>>> Initial video set to largeVideoRef (desktop waiting)');
          }
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
            console.log('>>> Initial my video stream set (desktop)');
          }
        }

        // Create deterministic peer IDs based on room
        const sanitizedRoom = roomName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const hostPeerId = `${sanitizedRoom}-host`;

        // Try to become the host first
        let peerId = hostPeerId;
        let otherPeerId = null;

        console.log('Attempting to join as host:', hostPeerId);

        const peer = new Peer(peerId, {
          host: '0.peerjs.com',
          secure: true,
          port: 443,
          path: '/',
          config: {
            iceServers: [
              // STUN servers for NAT traversal (multiple providers for reliability)
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:stun.services.mozilla.com' },
              { urls: 'stun:stun.stunprotocol.org:3478' },

              // OpenRelay TURN servers (free public TURN)
              {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },
              {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
              },

              // Twilio STUN (additional fallback)
              { urls: 'stun:global.stun.twilio.com:3478' },

              // Free public TURN servers (additional options)
              {
                urls: 'turn:relay.metered.ca:80',
                username: 'e97c26fbb6de3e0ba5245e5e',
                credential: '3TyKdRQwVpXEyVFJ'
              },
              {
                urls: 'turn:relay.metered.ca:443',
                username: 'e97c26fbb6de3e0ba5245e5e',
                credential: '3TyKdRQwVpXEyVFJ'
              },
              {
                urls: 'turn:relay.metered.ca:443?transport=tcp',
                username: 'e97c26fbb6de3e0ba5245e5e',
                credential: '3TyKdRQwVpXEyVFJ'
              }
            ],
            sdpSemantics: 'unified-plan',
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
          },
          debug: 0
        });

        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log('Successfully joined as:', id);
          if (mounted) {
            setMyPeerId(id);
            setIsHost(true); // This user is the host
            console.log('I am the host, waiting for participants...');
          }
        });

        peer.on('call', (call) => {
          console.log('>>> HOST: Receiving call from:', call.peer);
          call.answer(stream);
          callRef.current = call;

          // Establish data connection with participant
          const dataConn = peer.connect(call.peer);
          dataConn.on('open', () => {
            console.log('>>> HOST: Data connection established with participant');
            dataConnRef.current = dataConn;
          });

          call.on('stream', (remoteStream) => {
            console.log('>>> HOST: Received remote stream!');
            if (mounted && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              setIsConnected(true);
              console.log('>>> HOST: Connection established!');
            }
          });

          call.on('close', () => {
            console.log('Call closed');
            if (mounted) {
              setIsConnected(false);
              callRef.current = null;
              dataConnRef.current = null;
            }
          });

          call.on('error', (err) => {
            console.error('Call error:', err);
          });
        });

        // Listen for data connections (for end call signal)
        peer.on('connection', (conn) => {
          conn.on('open', () => {
            console.log('>>> HOST: Incoming data connection opened');
          });
          conn.on('data', (data) => {
            console.log('>>> HOST: Received data:', data);
            if (data.type === 'end-call') {
              console.log('>>> HOST: Participant ended the call');
              if (callRef.current) {
                callRef.current.close();
              }
              if (peerRef.current) {
                peerRef.current.destroy();
              }
              navigate('/');
            } else if (data.type === 'screen-share-start') {
              console.log('>>> HOST: Participant started screen sharing');
              setRemoteScreenSharing(true);
            } else if (data.type === 'screen-share-stop') {
              console.log('>>> HOST: Participant stopped screen sharing');
              setRemoteScreenSharing(false);
            } else if (data.type === 'whiteboard-start') {
              setRemoteWhiteboardActive(true);
              setTimeout(() => initCanvas(), 100);
            } else if (data.type === 'whiteboard-stop') {
              setRemoteWhiteboardActive(false);
            } else if (data.type === 'whiteboard-draw') {
              handleRemoteDrawing(data);
            } else if (data.type === 'whiteboard-clear') {
              const canvas = canvasRef.current;
              const ctx = ctxRef.current;
              if (canvas && ctx) {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
              }
            }
          });
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          console.log('Error type:', err.type);
          console.log('Error message:', err.message);

          // If host ID is taken, we are the second participant
          const isTakenError = err.type === 'unavailable-id' ||
                               (err.message && err.message.includes('is taken')) ||
                               (err.toString && err.toString().includes('is taken'));

          console.log('isTakenError check:', isTakenError);

          if (isTakenError) {
            console.log('>>> Host exists, joining as participant...');

            // Destroy the failed peer connection
            if (peer) {
              console.log('>>> Destroying old peer...');
              peer.destroy();
            }

            // Wait a bit for the peer to fully close before creating a new one
            console.log('>>> Setting timeout to create participant peer...');
            setTimeout(() => {
              console.log('>>> Timeout fired, mounted:', mounted);
              if (!mounted) {
                console.log('>>> Not mounted, skipping peer creation');
                return;
              }

              // Recreate peer with participant ID
              const participantId = `${sanitizedRoom}-participant-${Date.now()}`;
              console.log('>>> Creating participant peer with ID:', participantId);
              const newPeer = new Peer(participantId, {
              host: '0.peerjs.com',
              secure: true,
              port: 443,
              path: '/',
              config: {
                iceServers: [
                  // STUN servers for NAT traversal (multiple providers for reliability)
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' },
                  { urls: 'stun:stun2.l.google.com:19302' },
                  { urls: 'stun:stun3.l.google.com:19302' },
                  { urls: 'stun:stun4.l.google.com:19302' },
                  { urls: 'stun:stun.services.mozilla.com' },
                  { urls: 'stun:stun.stunprotocol.org:3478' },

                  // OpenRelay TURN servers (free public TURN)
                  {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                  },
                  {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                  },
                  {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                  },

                  // Twilio STUN (additional fallback)
                  { urls: 'stun:global.stun.twilio.com:3478' },

                  // Free public TURN servers (additional options)
                  {
                    urls: 'turn:relay.metered.ca:80',
                    username: 'e97c26fbb6de3e0ba5245e5e',
                    credential: '3TyKdRQwVpXEyVFJ'
                  },
                  {
                    urls: 'turn:relay.metered.ca:443',
                    username: 'e97c26fbb6de3e0ba5245e5e',
                    credential: '3TyKdRQwVpXEyVFJ'
                  },
                  {
                    urls: 'turn:relay.metered.ca:443?transport=tcp',
                    username: 'e97c26fbb6de3e0ba5245e5e',
                    credential: '3TyKdRQwVpXEyVFJ'
                  }
                ],
                sdpSemantics: 'unified-plan',
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 10,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
              },
              debug: 0
            });

            peerRef.current = newPeer;

            newPeer.on('open', (id) => {
              console.log('>>> PARTICIPANT: Peer opened with ID:', id);
              if (mounted) {
                setMyPeerId(id);
                setIsHost(false); // This user is a participant

                // Immediately try to call the host
                console.log('>>> PARTICIPANT: Attempting to call host:', hostPeerId);
                attemptConnection(newPeer, hostPeerId, stream);

                // Keep trying every 3 seconds
                connectionAttemptInterval = setInterval(() => {
                  if (!callRef.current && mounted) {
                    console.log('>>> PARTICIPANT: Retrying connection to host...');
                    attemptConnection(newPeer, hostPeerId, stream);
                  }
                }, 3000);
              }
            });

            newPeer.on('call', (call) => {
              console.log('>>> PARTICIPANT: Receiving call from:', call.peer);
              call.answer(stream);
              callRef.current = call;

              // Establish data connection with host
              const dataConn = newPeer.connect(call.peer);
              dataConn.on('open', () => {
                console.log('>>> PARTICIPANT: Data connection established with host');
                dataConnRef.current = dataConn;
              });

              call.on('stream', (remoteStream) => {
                console.log('>>> PARTICIPANT: Received remote stream!');
                if (mounted && remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                  setIsConnected(true);
                  console.log('>>> PARTICIPANT: Connection established!');
                }
              });

              call.on('close', () => {
                console.log('Call closed');
                if (mounted) {
                  setIsConnected(false);
                  callRef.current = null;
                  dataConnRef.current = null;
                }
              });
            });

            // Listen for data connections (for end call signal)
            newPeer.on('connection', (conn) => {
              conn.on('open', () => {
                console.log('>>> PARTICIPANT: Incoming data connection opened');
              });
              conn.on('data', (data) => {
                console.log('>>> PARTICIPANT: Received data:', data);
                if (data.type === 'end-call') {
                  console.log('>>> PARTICIPANT: Host ended the call for everyone');
                  if (callRef.current) {
                    callRef.current.close();
                  }
                  if (peerRef.current) {
                    peerRef.current.destroy();
                  }
                  navigate('/');
                } else if (data.type === 'screen-share-start') {
                  console.log('>>> PARTICIPANT: Host started screen sharing');
                  setRemoteScreenSharing(true);
                } else if (data.type === 'screen-share-stop') {
                  console.log('>>> PARTICIPANT: Host stopped screen sharing');
                  setRemoteScreenSharing(false);
                } else if (data.type === 'whiteboard-start') {
                  setRemoteWhiteboardActive(true);
                  setTimeout(() => initCanvas(), 100);
                } else if (data.type === 'whiteboard-stop') {
                  setRemoteWhiteboardActive(false);
                } else if (data.type === 'whiteboard-draw') {
                  handleRemoteDrawing(data);
                } else if (data.type === 'whiteboard-clear') {
                  const canvas = canvasRef.current;
                  const ctx = ctxRef.current;
                  if (canvas && ctx) {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.beginPath();
                  }
                }
              });
            });

            newPeer.on('error', (err) => {
              console.error('Participant peer error:', err);
              if (mounted && err.type !== 'peer-unavailable' && err.type !== 'unavailable-id' && !(err.message && err.message.includes('is taken'))) {
                setError('Ошибка соединения: ' + err.type);
              }
            });
            }, 500); // Wait 500ms before creating new peer
          } else if (err.type !== 'peer-unavailable' && !(err.message && err.message.includes('Could not connect to peer'))) {
            setError('Ошибка соединения: ' + err.type);
          }
        });

      } catch (err) {
        console.error('Error getting media:', err);
        if (mounted) {
          setError('Не удалось получить доступ к камере/микрофону');
        }
      }
    };

    const attemptConnection = (peer, targetPeerId, stream) => {
      if (callRef.current) {
        console.log('>>> attemptConnection: Already have a call, skipping');
        return;
      }

      try {
        console.log('>>> attemptConnection: Calling', targetPeerId);
        const call = peer.call(targetPeerId, stream);

        if (call) {
          console.log('>>> attemptConnection: Call object created successfully');
          callRef.current = call;

          // Establish data connection with host
          const dataConn = peer.connect(targetPeerId);
          dataConn.on('open', () => {
            console.log('>>> PARTICIPANT: Data connection established with host in attemptConnection');
            dataConnRef.current = dataConn;
          });

          call.on('stream', (remoteStream) => {
            console.log('>>> attemptConnection: Received remote stream!');
            console.log('>>> attemptConnection: remoteVideoRef.current:', remoteVideoRef.current);
            console.log('>>> attemptConnection: mounted:', mounted);
            console.log('>>> attemptConnection: remoteStream:', remoteStream);

            if (remoteVideoRef.current && mounted) {
              console.log('>>> attemptConnection: Setting srcObject...');
              remoteVideoRef.current.srcObject = remoteStream;
              setIsConnected(true);
              console.log('>>> attemptConnection: Video connected! isConnected set to true');
            } else {
              console.log('>>> attemptConnection: FAILED - remoteVideoRef.current is null or not mounted');
            }
          });

          call.on('close', () => {
            console.log('Call ended');
            if (mounted) {
              setIsConnected(false);
              callRef.current = null;
              dataConnRef.current = null;
            }
          });

          call.on('error', (err) => {
            console.error('>>> attemptConnection: Call error:', err);
            callRef.current = null;
            dataConnRef.current = null;
          });
        } else {
          console.log('>>> attemptConnection: peer.call returned null/undefined');
        }
      } catch (err) {
        console.error('>>> attemptConnection: Exception caught:', err);
      }
    };

    initializeCall();

    return () => {
      mounted = false;

      if (connectionAttemptInterval) {
        clearInterval(connectionAttemptInterval);
      }

      if (callRef.current) {
        callRef.current.close();
      }

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomName]);

  const toggleMic = () => {
    if (myStreamRef.current) {
      const audioTrack = myStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      }
    }
  };

  const toggleCamera = () => {
    if (myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
      }
    }
  };

  const leaveCall = () => {
    if (isHost && dataConnRef.current) {
      // Host ending call - notify all participants
      try {
        console.log('>>> HOST: Sending end-call signal to participant');
        dataConnRef.current.send({ type: 'end-call' });
        console.log('>>> HOST: End-call signal sent');

        // Wait a moment for the signal to be delivered
        setTimeout(() => {
          // Close connections and navigate
          if (dataConnRef.current) {
            dataConnRef.current.close();
          }
          if (callRef.current) {
            callRef.current.close();
          }
          if (peerRef.current) {
            peerRef.current.destroy();
          }
          navigate('/');
        }, 500);
      } catch (err) {
        console.error('Error sending end-call signal:', err);
        // Even if error, still leave
        if (callRef.current) {
          callRef.current.close();
        }
        navigate('/');
      }
    } else {
      // Participant or no connection - just leave
      if (callRef.current) {
        callRef.current.close();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      navigate('/');
    }
  };

  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    alert('Ссылка скопирована! Отправьте её другому участнику.');
  };

  const startScreenShare = async () => {
    try {
      // Get screen stream with system dialog for selecting what to share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      screenStreamRef.current = screenStream;

      // Set screen to video element
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
      }

      // Replace video track in peer connection
      if (callRef.current && callRef.current.peerConnection) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = callRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }

      // Notify remote user that we're sharing screen
      if (dataConnRef.current) {
        dataConnRef.current.send({ type: 'screen-share-start' });
      }

      setIsScreenSharing(true);

      // Listen for when user stops sharing via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.error('Error starting screen share:', err);
      alert('Не удалось начать демонстрацию экрана');
    }
  };

  const stopScreenShare = async () => {
    // Stop screen stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Switch back to camera
    if (callRef.current && callRef.current.peerConnection && myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      const sender = callRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    }

    // Notify remote user that we stopped sharing
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: 'screen-share-stop' });
    }

    setIsScreenSharing(false);
  };

  const toggleWhiteboard = () => {
    const newState = !isWhiteboardActive;
    setIsWhiteboardActive(newState);

    // Notify remote user
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: newState ? 'whiteboard-start' : 'whiteboard-stop' });
    }

    // Initialize canvas when opening
    if (newState) {
      setTimeout(() => {
        initCanvas();
      }, 100);
    }
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to fill container
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.strokeStyle = tool === 'eraser' ? '#1a1a2e' : brushColor;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();

    // Send drawing data to remote
    if (dataConnRef.current) {
      dataConnRef.current.send({
        type: 'whiteboard-draw',
        x: x / canvas.width,
        y: y / canvas.height,
        color: tool === 'eraser' ? '#1a1a2e' : brushColor,
        size: tool === 'eraser' ? brushSize * 3 : brushSize,
        drawing: true
      });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (ctxRef.current) {
      ctxRef.current.beginPath();
    }
    // Notify remote that stroke ended
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: 'whiteboard-draw', drawing: false });
    }
  };

  const handleRemoteDrawing = (data) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (data.drawing) {
      const x = data.x * canvas.width;
      const y = data.y * canvas.height;
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();

    // Notify remote
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: 'whiteboard-clear' });
    }
  };

  const switchVideo = () => {
    setIsMyVideoLarge(!isMyVideoLarge);
  };

  const handleMouseDown = (e) => {
    setDragStartTime(Date.now());
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - smallVideoPosition.x,
      y: e.clientY - smallVideoPosition.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      dragAnimationFrameRef.current = requestAnimationFrame(() => {
        setSmallVideoPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (dragAnimationFrameRef.current) {
      cancelAnimationFrame(dragAnimationFrameRef.current);
    }
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setDragStartTime(Date.now());
    setIsDragging(true);
    setDragOffset({
      x: touch.clientX - smallVideoPosition.x,
      y: touch.clientY - smallVideoPosition.y
    });
  };

  const handleTouchMove = (e) => {
    if (isDragging) {
      const touch = e.touches[0];
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      dragAnimationFrameRef.current = requestAnimationFrame(() => {
        setSmallVideoPosition({
          x: touch.clientX - dragOffset.x,
          y: touch.clientY - dragOffset.y
        });
      });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-900">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Hidden video elements - always render for desktop refs */}
      <video ref={myVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            <h1 className="text-white font-bold text-lg tracking-wide">{roomName}</h1>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${isConnected ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30'}`}>
            {isConnected ? '● Подключено' : '○ Ожидание...'}
          </span>

          {/* Connection Quality Indicator */}
          {isConnected && (
            <div className={`group relative px-3 py-1.5 rounded-full text-xs font-semibold cursor-help transition-all ${
              connectionQuality.quality === 'excellent' ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30' :
              connectionQuality.quality === 'good' ? 'bg-gradient-to-r from-green-500/20 to-lime-500/20 text-green-400 border border-green-500/30' :
              connectionQuality.quality === 'poor' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30' :
              'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
            }`}>
              <div className="flex items-center gap-1.5">
                {connectionQuality.quality === 'excellent' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    Отлично
                  </>
                )}
                {connectionQuality.quality === 'good' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z" />
                    </svg>
                    Хорошо
                  </>
                )}
                {connectionQuality.quality === 'poor' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
                    </svg>
                    Средне
                  </>
                )}
                {connectionQuality.quality === 'bad' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                    Плохо
                  </>
                )}
              </div>

              {/* Tooltip with detailed stats */}
              <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-2xl z-50">
                <div className="text-white space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-gray-300">Статистика соединения</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Задержка (RTT):</span>
                      <span className="text-xs font-semibold">{connectionQuality.rtt}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Потеря пакетов:</span>
                      <span className="text-xs font-semibold">{connectionQuality.packetLoss}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Дрожание:</span>
                      <span className="text-xs font-semibold">{connectionQuality.jitter}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Битрейт:</span>
                      <span className="text-xs font-semibold">{connectionQuality.bitrate} kbps</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={copyRoomLink}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Пригласить участника
        </button>
      </div>

      {/* Video Grid - Fullscreen */}
      <div className="absolute inset-0">
        {(isWhiteboardActive || remoteWhiteboardActive) && isConnected ? (
          // Whiteboard Layout - Canvas fullscreen, cameras in top right corner
          <>
            {/* Whiteboard Canvas - Fullscreen */}
            <div className="absolute inset-0 bg-[#1a1a2e] flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            {/* Whiteboard Tools */}
            <div className="absolute top-20 left-4 z-30 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              {/* Pen Tool */}
              <button
                onClick={() => setTool('pen')}
                className={`p-3 rounded-xl transition-all ${tool === 'pen' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Карандаш"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              {/* Eraser Tool */}
              <button
                onClick={() => setTool('eraser')}
                className={`p-3 rounded-xl transition-all ${tool === 'eraser' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Ластик"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Clear */}
              <button
                onClick={clearCanvas}
                className="p-3 rounded-xl bg-red-600 hover:bg-red-700 transition-all"
                title="Очистить"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Divider */}
              <div className="h-px bg-white/20 my-1"></div>
              {/* Colors */}
              {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'].map(color => (
                <button
                  key={color}
                  onClick={() => { setBrushColor(color); setTool('pen'); }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${brushColor === color && tool === 'pen' ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              {/* Divider */}
              <div className="h-px bg-white/20 my-1"></div>
              {/* Brush Size */}
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Small Cameras in Top Right Corner */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              {/* My Camera */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <video
                  ref={mySmallCameraRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                />
              </div>
              {/* Remote Camera */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <video
                  ref={remoteSmallCameraRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </>
        ) : (isScreenSharing || remoteScreenSharing) && isConnected ? (
          // Screen Sharing Layout - Screen fullscreen, cameras in top right corner
          <>
            {/* Screen Share Video - Fullscreen */}
            <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={isScreenSharing ? screenVideoRef : remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Small Cameras in Top Right Corner */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              {/* My Camera */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <video
                  ref={mySmallCameraRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                />
              </div>
              {/* Remote Camera */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20">
                <video
                  ref={isScreenSharing ? remoteSmallCameraRef : myVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${!isScreenSharing ? 'mirror' : ''}`}
                />
              </div>
            </div>
          </>
        ) : isMobile ? (
          // Mobile Layout - WhatsApp Style with draggable small video
          <>
            {/* Large Video */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-gradient"></div>

              <video
                ref={largeVideoRef}
                autoPlay
                muted={!isConnected || isMyVideoLarge}
                playsInline
                className={`relative z-10 w-full h-full object-cover ${!isConnected || isMyVideoLarge ? 'mirror' : ''}`}
              />

              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full backdrop-blur-xl border-2 border-white/20">
                      <svg className="w-12 h-12 text-white/60 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-white text-lg font-semibold mb-2">Ожидание участника...</p>
                    <p className="text-white/60 text-sm">Поделитесь ссылкой для подключения</p>
                  </div>
                </div>
              )}

              {/* Corner decoration */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full pointer-events-none"></div>
            </div>

            {/* Small Video (draggable & clickable) */}
        <div
          style={{
            left: `${smallVideoPosition.x}px`,
            top: `${smallVideoPosition.y}px`,
            display: isConnected ? 'flex' : 'none',
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={(e) => {
            const clickDuration = Date.now() - dragStartTime;
            if (clickDuration < 200) { // Only switch if it was a quick click (not drag)
              switchVideo();
            }
          }}
          className={`draggable-video absolute w-40 h-56 md:w-48 md:h-64 bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-2xl overflow-hidden z-10 items-center justify-center ${
            isDragging
              ? 'cursor-grabbing scale-105 border-4 border-indigo-500 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.6)]'
              : 'cursor-grab border-2 border-white/20 hover:border-indigo-400/60 shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.4)] hover:scale-105'
          }`}
        >
          <video
            ref={smallVideoRef}
            autoPlay
            muted={!isMyVideoLarge}
            playsInline
            className={`w-full h-full object-cover ${!isMyVideoLarge ? 'mirror' : ''}`}
          />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

            {/* Name badge */}
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
              <p className="text-white font-semibold text-xs truncate">{isMyVideoLarge ? 'Собеседник' : userName}</p>
            </div>

            {/* Action icons */}
            <div className="absolute top-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur-xl rounded-full p-2 border border-white/20 shadow-lg hover:bg-black/80 transition-colors">
                <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
                </svg>
              </div>
            </div>

            <div className="absolute top-3 right-3">
              <div className="bg-gradient-to-br from-indigo-500/80 to-purple-500/80 backdrop-blur-xl rounded-full p-2 border border-white/30 shadow-lg hover:from-indigo-600 hover:to-purple-600 transition-all">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </div>
          </div>
          </>
        ) : (
          // Desktop Layout - Zoom Style with two equal videos
          <>
            {!isConnected ? (
              // Waiting state - one large video
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-gradient"></div>

                <video
                  ref={largeVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="relative z-10 w-full h-full object-cover mirror"
                />

                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full backdrop-blur-xl border-2 border-white/20">
                      <svg className="w-12 h-12 text-white/60 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-white text-lg font-semibold mb-2">Ожидание участника...</p>
                    <p className="text-white/60 text-sm">Поделитесь ссылкой для подключения</p>
                  </div>
                </div>

                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full pointer-events-none"></div>
              </div>
            ) : (
              // Connected state - two equal videos side by side
              <div className="absolute inset-0 grid grid-cols-2 gap-0">
                {/* My Video */}
                <div className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10"></div>

                  <video
                    ref={myVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="relative z-10 w-full h-full object-cover mirror"
                  />

                  {/* Name badge */}
                  <div className="absolute bottom-4 left-4 right-4 px-4 py-2 bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
                    <p className="text-white font-semibold text-sm truncate">{userName}</p>
                  </div>

                  {/* Corner decoration */}
                  <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full pointer-events-none"></div>
                </div>

                {/* Remote Video */}
                <div className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-indigo-500/10"></div>

                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="relative z-10 w-full h-full object-cover"
                  />

                  {/* Name badge */}
                  <div className="absolute bottom-4 left-4 right-4 px-4 py-2 bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
                    <p className="text-white font-semibold text-sm truncate">Собеседник</p>
                  </div>

                  {/* Corner decoration */}
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full pointer-events-none"></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-50 px-4 py-6 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`group relative p-4 rounded-2xl transition-all duration-200 ${
              isMicOn
                ? 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-lg'
                : 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/50'
            } text-white active:scale-95`}
            title={isMicOn ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {isMicOn ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleCamera}
            className={`group relative p-4 rounded-2xl transition-all duration-200 ${
              isCameraOn
                ? 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-lg'
                : 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/50'
            } text-white active:scale-95`}
            title={isCameraOn ? 'Выключить камеру' : 'Включить камеру'}
          >
            {isCameraOn ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>

          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`group relative p-4 rounded-2xl transition-all duration-200 ${
              isScreenSharing
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-500/50'
                : 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-lg'
            } text-white active:scale-95`}
            title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={toggleWhiteboard}
            className={`group relative p-4 rounded-2xl transition-all duration-200 ${
              isWhiteboardActive
                ? 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/50'
                : 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 shadow-lg'
            } text-white active:scale-95`}
            title={isWhiteboardActive ? 'Закрыть доску' : 'Открыть доску'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </button>

          <button
            onClick={leaveCall}
            className="group relative p-4 px-8 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-200 shadow-lg shadow-red-500/50 hover:shadow-red-500/70 active:scale-95 ml-2 flex items-center gap-3"
            title="Завершить звонок"
          >
            <svg className="w-6 h-6 rotate-135" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
            <span className="font-semibold">Завершить</span>
          </button>
        </div>
      </div>

      <style>{`
        video.mirror {
          transform: scaleX(-1);
        }
        * {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
        @keyframes pulse-border {
          0%, 100% {
            border-color: rgba(99, 102, 241, 0.3);
          }
          50% {
            border-color: rgba(99, 102, 241, 0.6);
          }
        }
        .draggable-video {
          will-change: transform;
          transition: ${isDragging ? 'none' : 'all 0.2s ease-out'};
        }
      `}</style>
    </div>
  );
};

export default VideoCall;
