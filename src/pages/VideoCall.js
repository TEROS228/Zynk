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
  const [smallVideoPosition, setSmallVideoPosition] = useState(() => {
    const saved = localStorage.getItem('smallVideoPosition');
    return saved ? JSON.parse(saved) : { x: 16, y: 16 };
  });
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
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState('pen'); // pen, eraser
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [remoteCursor, setRemoteCursor] = useState({ x: 0, y: 0, visible: false, name: '' });

  const myVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const gridCanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const gridCtxRef = useRef(null);
  const drawingDataRef = useRef([]); // Store all drawing strokes
  const remoteVideoRef = useRef(null);
  const largeVideoRef = useRef(null);
  const smallVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const mySmallCameraRef = useRef(null);
  const remoteSmallCameraRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const myCameraStreamRef = useRef(null); // Separate camera stream for screen sharing mode
  const callRef = useRef(null);
  const dataConnRef = useRef(null);
  const dragAnimationFrameRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const userName = localStorage.getItem('userName') || 'Guest';

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

  // Save small video position to localStorage
  useEffect(() => {
    localStorage.setItem('smallVideoPosition', JSON.stringify(smallVideoPosition));
  }, [smallVideoPosition]);

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
    const isSpecialMode = (isScreenSharing || remoteScreenSharing) || (isWhiteboardActive || remoteWhiteboardActive);

    if (isSpecialMode && isConnected) {
      // For screen sharing: use myCameraStreamRef (saved camera) if available, otherwise myStreamRef
      const myCameraSource = (isScreenSharing && myCameraStreamRef.current) ? myCameraStreamRef.current : myStreamRef.current;

      // Set my camera to small camera ref (always my camera - NOT screen)
      if (mySmallCameraRef.current && myCameraSource && mySmallCameraRef.current.srcObject !== myCameraSource) {
        mySmallCameraRef.current.srcObject = myCameraSource;
      }
      // Set remote camera to small camera ref
      // Note: when remote is sharing screen, remoteStreamRef contains their screen (via replaceTrack)
      // We still show it because we can't access their camera separately
      if (remoteSmallCameraRef.current && remoteStreamRef.current && remoteSmallCameraRef.current.srcObject !== remoteStreamRef.current) {
        remoteSmallCameraRef.current.srcObject = remoteStreamRef.current;
      }
      // Set screen video ref for screen sharing (my local screen)
      if (isScreenSharing && screenVideoRef.current && screenStreamRef.current && screenVideoRef.current.srcObject !== screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
      }
      // When remote is sharing, show their screen in the main video
      if (remoteScreenSharing && remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    } else if (isConnected && !isSpecialMode) {
      // Restore normal video layout after closing whiteboard/screenshare
      console.log('>>> Restoring normal video layout');

      // Small delay to ensure state is updated
      setTimeout(() => {
        if (isMobile) {
          // Mobile layout
          if (largeVideoRef.current) {
            largeVideoRef.current.srcObject = isMyVideoLarge ? myStreamRef.current : remoteStreamRef.current;
          }
          if (smallVideoRef.current) {
            smallVideoRef.current.srcObject = isMyVideoLarge ? remoteStreamRef.current : myStreamRef.current;
          }
        } else {
          // Desktop layout
          if (isMyVideoLarge) {
            if (myVideoRef.current && myStreamRef.current) {
              myVideoRef.current.srcObject = myStreamRef.current;
            }
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
            }
          } else {
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
            }
            if (myVideoRef.current && myStreamRef.current) {
              myVideoRef.current.srcObject = myStreamRef.current;
            }
          }
        }
      }, 100);
    }
  }, [isScreenSharing, remoteScreenSharing, isWhiteboardActive, remoteWhiteboardActive, isConnected, isMobile, isMyVideoLarge]);

  // Sync video streams to display elements (mobile only)
  useEffect(() => {
    if (!isMobile) return; // Skip for desktop layout

    if (largeVideoRef.current && myStreamRef.current) {
      if (!isConnected) {
        largeVideoRef.current.srcObject = myStreamRef.current;
      } else if (isConnected) {
        if (isMyVideoLarge) {
          largeVideoRef.current.srcObject = myStreamRef.current;
        } else if (remoteStreamRef.current) {
          largeVideoRef.current.srcObject = remoteStreamRef.current;
        }
      }
    }

    if (smallVideoRef.current && isConnected) {
      if (isMyVideoLarge && remoteStreamRef.current) {
        smallVideoRef.current.srcObject = remoteStreamRef.current;
      } else if (!isMyVideoLarge && myStreamRef.current) {
        smallVideoRef.current.srcObject = myStreamRef.current;
      }
    }
  }, [isConnected, isMyVideoLarge, isMobile]);

  // Sync video streams for desktop
  useEffect(() => {
    if (isMobile) return; // Skip for mobile

    if (!isConnected) {
      // Waiting state - show my video in large view
      if (largeVideoRef.current && myStreamRef.current) {
        largeVideoRef.current.srcObject = myStreamRef.current;
      }
    } else {
      // Connected state - swap based on isMyVideoLarge
      if (isMyVideoLarge) {
        // My video is large, remote is small
        if (myVideoRef.current && myStreamRef.current) {
          myVideoRef.current.srcObject = myStreamRef.current;
        }
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      } else {
        // Remote video is large, my video is small
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        if (myVideoRef.current && myStreamRef.current) {
          myVideoRef.current.srcObject = myStreamRef.current;
        }
      }
    }
  }, [isConnected, isMobile, isMyVideoLarge]);

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
            if (mounted) {
              remoteStreamRef.current = remoteStream;
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
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
              drawingDataRef.current = [];
              if (ctxRef.current && canvasRef.current) {
                ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            } else if (data.type === 'cursor-position') {
              handleRemoteCursor(data);
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
                if (mounted) {
                  remoteStreamRef.current = remoteStream;
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                  }
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
                  drawingDataRef.current = [];
                  if (ctxRef.current && canvasRef.current) {
                    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  }
                } else if (data.type === 'cursor-position') {
                  handleRemoteCursor(data);
                }
              });
            });

            newPeer.on('error', (err) => {
              console.error('Participant peer error:', err);
              if (mounted && err.type !== 'peer-unavailable' && err.type !== 'unavailable-id' && !(err.message && err.message.includes('is taken'))) {
                setError('Connection error: ' + err.type);
              }
            });
            }, 500); // Wait 500ms before creating new peer
          } else if (err.type !== 'peer-unavailable' && !(err.message && err.message.includes('Could not connect to peer'))) {
            setError('Connection error: ' + err.type);
          }
        });

      } catch (err) {
        console.error('Error getting media:', err);
        if (mounted) {
          setError('Could not access camera/microphone');
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
            if (mounted) {
              remoteStreamRef.current = remoteStream;
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
              setIsConnected(true);
              console.log('>>> attemptConnection: Video connected!');
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
    alert('Link copied! Send it to another participant.');
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

      // Create a separate stream with just the camera for showing in small window
      // Clone the camera track so it's not affected by replaceTrack
      if (myStreamRef.current) {
        const cameraTrack = myStreamRef.current.getVideoTracks()[0];
        if (cameraTrack) {
          myCameraStreamRef.current = new MediaStream([cameraTrack]);
        }
      }

      // Set screen to video element
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
      }

      // Replace video track in peer connection (this sends screen to remote)
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
      alert('Could not start screen sharing');
    }
  };

  const stopScreenShare = async () => {
    // Stop screen stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Clear camera stream ref (don't stop tracks - they're still used in myStreamRef)
    myCameraStreamRef.current = null;

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
    const gridCanvas = gridCanvasRef.current;
    if (!canvas || !gridCanvas) return;

    // Set canvas size to fill container
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    gridCanvas.width = gridCanvas.offsetWidth;
    gridCanvas.height = gridCanvas.offsetHeight;

    const ctx = canvas.getContext('2d');
    const gridCtx = gridCanvas.getContext('2d');

    // Clear drawing canvas (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    gridCtxRef.current = gridCtx;

    // Draw grid on grid canvas
    drawGrid();

    // Redraw all stored strokes
    redrawAllStrokes();
  };

  const drawGrid = () => {
    const gridCanvas = gridCanvasRef.current;
    const gridCtx = gridCtxRef.current;
    if (!gridCanvas || !gridCtx) return;

    // White background
    gridCtx.fillStyle = '#ffffff';
    gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

    // Draw grid with offset
    gridCtx.strokeStyle = '#e5e7eb';
    gridCtx.lineWidth = 1;
    const gridSize = 30;

    const offsetX = canvasOffset.x % gridSize;
    const offsetY = canvasOffset.y % gridSize;

    // Vertical lines
    for (let x = offsetX; x <= gridCanvas.width; x += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(x, 0);
      gridCtx.lineTo(x, gridCanvas.height);
      gridCtx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y <= gridCanvas.height; y += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y);
      gridCtx.lineTo(gridCanvas.width, y);
      gridCtx.stroke();
    }
  };

  const redrawAllStrokes = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawingDataRef.current.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x + canvasOffset.x, firstPoint.y + canvasOffset.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x + canvasOffset.x, point.y + canvasOffset.y);
      }
      ctx.stroke();
    });
  };

  const currentStrokeRef = useRef(null);
  const remoteStrokeRef = useRef(null);

  const startDrawing = (e) => {
    // Check if middle mouse button, shift is held, or pan tool selected
    if (e.button === 1 || e.shiftKey || tool === 'pan') {
      startPanning(e);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Store in world coordinates (without offset)
    const worldX = x - canvasOffset.x;
    const worldY = y - canvasOffset.y;

    // Start new stroke with last screen position for drawing
    currentStrokeRef.current = {
      color: tool === 'eraser' ? '#ffffff' : brushColor,
      size: tool === 'eraser' ? brushSize * 3 : brushSize,
      points: [{ x: worldX, y: worldY }],
      lastScreenX: x,
      lastScreenY: y
    };

    // Send cursor position
    if (dataConnRef.current) {
      dataConnRef.current.send({
        type: 'cursor-position',
        x: worldX,
        y: worldY,
        name: userName
      });
    }
  };

  const draw = (e) => {
    if (isPanning) {
      handlePanning(e);
      return;
    }

    if (!isDrawing || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Store in world coordinates
    const worldX = x - canvasOffset.x;
    const worldY = y - canvasOffset.y;

    currentStrokeRef.current.points.push({ x: worldX, y: worldY });

    // Draw line segment from last point to current (isolated from other drawings)
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = currentStrokeRef.current.color;
    ctx.lineWidth = currentStrokeRef.current.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(currentStrokeRef.current.lastScreenX, currentStrokeRef.current.lastScreenY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    currentStrokeRef.current.lastScreenX = x;
    currentStrokeRef.current.lastScreenY = y;

    // Send drawing data to remote (world coordinates)
    if (dataConnRef.current) {
      dataConnRef.current.send({
        type: 'whiteboard-draw',
        x: worldX,
        y: worldY,
        color: currentStrokeRef.current.color,
        size: currentStrokeRef.current.size,
        drawing: true
      });
    }
  };

  const stopDrawing = () => {
    if (isPanning) {
      stopPanning();
      return;
    }

    setIsDrawing(false);

    // Save completed stroke
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      drawingDataRef.current.push({
        color: currentStrokeRef.current.color,
        size: currentStrokeRef.current.size,
        points: currentStrokeRef.current.points
      });
    }
    currentStrokeRef.current = null;

    // Notify remote that stroke ended
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: 'whiteboard-draw', drawing: false });
    }
  };

  const startPanning = (e) => {
    setIsPanning(true);
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    setPanStart({ x: clientX - canvasOffset.x, y: clientY - canvasOffset.y });
  };

  const handlePanning = (e) => {
    if (!isPanning) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    const newOffset = {
      x: clientX - panStart.x,
      y: clientY - panStart.y
    };
    setCanvasOffset(newOffset);
    drawGrid();
    redrawAllStrokes();
  };

  const stopPanning = () => {
    setIsPanning(false);
  };

  const handleRemoteDrawing = (data) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (data.drawing) {
      // Track remote stroke using world coordinates only
      if (!remoteStrokeRef.current) {
        remoteStrokeRef.current = {
          color: data.color,
          size: data.size,
          points: [{ x: data.x, y: data.y }],
          lastWorldX: data.x,
          lastWorldY: data.y
        };
      } else {
        // Calculate screen coordinates from world coordinates using current offset
        // This ensures correct positioning even if local user panned
        const lastScreenX = remoteStrokeRef.current.lastWorldX + canvasOffset.x;
        const lastScreenY = remoteStrokeRef.current.lastWorldY + canvasOffset.y;
        const currentScreenX = data.x + canvasOffset.x;
        const currentScreenY = data.y + canvasOffset.y;

        // Only draw if the line segment is visible on screen
        const isVisible = (
          (lastScreenX >= -100 && lastScreenX <= canvas.width + 100) ||
          (currentScreenX >= -100 && currentScreenX <= canvas.width + 100)
        ) && (
          (lastScreenY >= -100 && lastScreenY <= canvas.height + 100) ||
          (currentScreenY >= -100 && currentScreenY <= canvas.height + 100)
        );

        if (isVisible) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(lastScreenX, lastScreenY);
          ctx.lineTo(currentScreenX, currentScreenY);
          ctx.stroke();
          ctx.restore();
        }

        remoteStrokeRef.current.points.push({ x: data.x, y: data.y });
        remoteStrokeRef.current.lastWorldX = data.x;
        remoteStrokeRef.current.lastWorldY = data.y;
      }
    } else {
      // Save remote stroke
      if (remoteStrokeRef.current && remoteStrokeRef.current.points.length > 1) {
        drawingDataRef.current.push({
          color: remoteStrokeRef.current.color,
          size: remoteStrokeRef.current.size,
          points: remoteStrokeRef.current.points
        });
      }
      remoteStrokeRef.current = null;
    }
  };

  const handleRemoteCursor = (data) => {
    // Convert world coordinates to screen
    const screenX = data.x + canvasOffset.x;
    const screenY = data.y + canvasOffset.y;
    setRemoteCursor({
      x: screenX,
      y: screenY,
      worldX: data.x,
      worldY: data.y,
      visible: true,
      name: data.name || 'Participant'
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Clear all drawing data
    drawingDataRef.current = [];

    // Clear only drawing canvas (grid stays on separate layer)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    // For desktop (right-based positioning), calculate from right edge
    const rightPos = window.innerWidth - e.clientX - (isMobile ? 0 : 256); // 256 = video width on desktop
    setDragOffset({
      x: isMobile ? e.clientX - smallVideoPosition.x : rightPos - smallVideoPosition.x,
      y: e.clientY - smallVideoPosition.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current);
      }
      dragAnimationFrameRef.current = requestAnimationFrame(() => {
        if (isMobile) {
          setSmallVideoPosition({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          });
        } else {
          // Desktop: position from right edge
          const rightPos = window.innerWidth - e.clientX - 256;
          setSmallVideoPosition({
            x: Math.max(16, rightPos - dragOffset.x),
            y: Math.max(80, e.clientY - dragOffset.y) // 80 to stay below header
          });
        }
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
    const rightPos = window.innerWidth - touch.clientX - (isMobile ? 0 : 256);
    setDragOffset({
      x: isMobile ? touch.clientX - smallVideoPosition.x : rightPos - smallVideoPosition.x,
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
        if (isMobile) {
          setSmallVideoPosition({
            x: touch.clientX - dragOffset.x,
            y: touch.clientY - dragOffset.y
          });
        } else {
          const rightPos = window.innerWidth - touch.clientX - 256;
          setSmallVideoPosition({
            x: Math.max(16, rightPos - dragOffset.x),
            y: Math.max(80, touch.clientY - dragOffset.y)
          });
        }
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Back to Home
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

      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            <h1 className="text-white font-bold text-lg tracking-wide">{roomName}</h1>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${isConnected ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30'}`}>
            {isConnected ? '● Connected' : '○ Waiting...'}
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
                    Excellent
                  </>
                )}
                {connectionQuality.quality === 'good' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z" />
                    </svg>
                    Good
                  </>
                )}
                {connectionQuality.quality === 'poor' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
                    </svg>
                    Fair
                  </>
                )}
                {connectionQuality.quality === 'bad' && (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                    Poor
                  </>
                )}
              </div>

              {/* Tooltip with detailed stats */}
              <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-2xl z-50">
                <div className="text-white space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-gray-300">Connection Stats</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Latency (RTT):</span>
                      <span className="text-xs font-semibold">{connectionQuality.rtt}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Packet Loss:</span>
                      <span className="text-xs font-semibold">{connectionQuality.packetLoss}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Jitter:</span>
                      <span className="text-xs font-semibold">{connectionQuality.jitter}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Bitrate:</span>
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
          Invite Participant
        </button>
      </div>

      {/* Video Grid - Fullscreen */}
      <div className="absolute inset-0">
        {(isWhiteboardActive || remoteWhiteboardActive) ? (
          // Whiteboard Layout - Canvas fullscreen, cameras in top right corner
          <>
            {/* Whiteboard Canvas - Fullscreen with two layers */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Grid layer (background) */}
              <canvas
                ref={gridCanvasRef}
                className="absolute inset-0 w-full h-full"
              />
              {/* Drawing layer (foreground) */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full ${isPanning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}`}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />

              {/* Remote user cursor indicator */}
              {remoteCursor.visible && isConnected && (() => {
                const canvas = canvasRef.current;
                if (!canvas) return null;

                const screenX = remoteCursor.worldX + canvasOffset.x;
                const screenY = remoteCursor.worldY + canvasOffset.y;
                const isOffScreen = screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height;

                if (isOffScreen) {
                  // Calculate arrow direction
                  const centerX = canvas.width / 2;
                  const centerY = canvas.height / 2;
                  const angle = Math.atan2(screenY - centerY, screenX - centerX);

                  // Calculate position on edge
                  const margin = 60;
                  let arrowX = centerX + Math.cos(angle) * (centerX - margin);
                  let arrowY = centerY + Math.sin(angle) * (centerY - margin);

                  // Clamp to screen edges
                  arrowX = Math.max(margin, Math.min(canvas.width - margin, arrowX));
                  arrowY = Math.max(margin, Math.min(canvas.height - margin, arrowY));

                  return (
                    <div
                      className="absolute z-20 flex items-center gap-2 animate-pulse"
                      style={{ left: arrowX, top: arrowY, transform: 'translate(-50%, -50%)' }}
                    >
                      <div
                        className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50"
                        style={{ transform: `rotate(${angle}rad)` }}
                      >
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 17l5-5-5-5v10z" />
                        </svg>
                      </div>
                      <span className="px-2 py-1 bg-gray-900/90 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                        {remoteCursor.name}
                      </span>
                    </div>
                  );
                } else {
                  // Show cursor on canvas
                  return (
                    <div
                      className="absolute z-20 pointer-events-none transition-all duration-75"
                      style={{ left: screenX, top: screenY, transform: 'translate(-50%, -50%)' }}
                    >
                      <div className="relative">
                        <svg className="w-6 h-6 text-purple-500 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.88 3.06c-.36-.35-.88-.13-.88.35z" />
                        </svg>
                        <span className="absolute left-6 top-4 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap shadow-lg">
                          {remoteCursor.name}
                        </span>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Whiteboard Tools */}
            <div className="absolute top-20 left-4 z-30 flex flex-col gap-2 bg-gray-900/80 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              {/* Pen Tool */}
              <button
                onClick={() => setTool('pen')}
                className={`p-3 rounded-xl transition-all ${tool === 'pen' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Pen"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              {/* Eraser Tool */}
              <button
                onClick={() => setTool('eraser')}
                className={`p-3 rounded-xl transition-all ${tool === 'eraser' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Eraser"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Pan Tool */}
              <button
                onClick={() => setTool('pan')}
                className={`p-3 rounded-xl transition-all ${tool === 'pan' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Pan (Shift+drag)"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 7l1.44 1.44L7.88 12l3.56 3.56L10 17l-5-5 5-5zm4 0l5 5-5 5-1.44-1.44L16.12 12l-3.56-3.56L14 7z" />
                </svg>
              </button>
              {/* Clear */}
              <button
                onClick={clearCanvas}
                className="p-3 rounded-xl bg-red-600 hover:bg-red-700 transition-all"
                title="Clear"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Divider */}
              <div className="h-px bg-white/20 my-1"></div>
              {/* Colors */}
              {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'].map(color => (
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
              {/* Pan hint */}
              <div className="text-[10px] text-gray-400 text-center mt-1">
                Shift + drag = pan
              </div>
            </div>

            {/* Small Cameras in Top Right Corner - only show when connected */}
            {isConnected && (
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
            )}
          </>
        ) : (isScreenSharing || remoteScreenSharing) && isConnected ? (
          // Screen Sharing Layout - Screen fullscreen, both cameras in corner
          <>
            {/* Screen Share Video - Fullscreen */}
            <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
              {isScreenSharing ? (
                // I'm sharing - show my screen locally
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                // Remote is sharing - show their stream (which now contains screen via replaceTrack)
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Both Cameras in Top Right Corner */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              {/* My Camera - always my camera (not screen) */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20 relative">
                <video
                  ref={mySmallCameraRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                />
                <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded text-white text-xs">
                  {userName}
                </div>
              </div>
              {/* Remote Camera/Screen */}
              <div className="w-32 h-24 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/20 relative">
                <video
                  ref={remoteSmallCameraRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded text-white text-xs">
                  Partner
                </div>
              </div>
            </div>

            {/* Screen sharing indicator */}
            <div className="absolute top-4 left-4 z-20 px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">
                {isScreenSharing ? 'You are sharing your screen' : 'Partner is sharing screen'}
              </span>
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
                    <p className="text-white text-lg font-semibold mb-2">Waiting for participant...</p>
                    <p className="text-white/60 text-sm">Share the link to connect</p>
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
              <p className="text-white font-semibold text-xs truncate">{isMyVideoLarge ? 'Partner' : userName}</p>
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
                    <p className="text-white text-lg font-semibold mb-2">Waiting for participant...</p>
                    <p className="text-white/60 text-sm">Share the link to connect</p>
                  </div>
                </div>

                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full pointer-events-none"></div>
              </div>
            ) : (
              // Connected state - fullscreen + small video in corner (like mobile)
              <>
                {/* Large Video - Fullscreen */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-gradient"></div>

                  <video
                    ref={isMyVideoLarge ? myVideoRef : remoteVideoRef}
                    autoPlay
                    muted={isMyVideoLarge}
                    playsInline
                    className={`relative z-10 w-full h-full object-cover ${isMyVideoLarge ? 'mirror' : ''}`}
                  />

                  {/* Name badge */}
                  <div className="absolute bottom-24 left-4 px-4 py-2 bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
                    <p className="text-white font-semibold text-sm truncate">{isMyVideoLarge ? userName : 'Partner'}</p>
                  </div>

                  {/* Corner decoration */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-br-full pointer-events-none"></div>
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-purple-500/20 to-transparent rounded-tl-full pointer-events-none"></div>
                </div>

                {/* Small Video (draggable & clickable) */}
                <div
                  style={{
                    right: `${smallVideoPosition.x}px`,
                    top: `${smallVideoPosition.y}px`,
                    transition: isDragging ? 'none' : 'all 0.3s ease-out',
                  }}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onClick={(e) => {
                    const clickDuration = Date.now() - dragStartTime;
                    if (clickDuration < 200) {
                      switchVideo();
                    }
                  }}
                  className={`absolute w-64 h-48 bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-2xl overflow-hidden z-20 ${
                    isDragging
                      ? 'cursor-grabbing scale-105 border-4 border-indigo-500 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.6)]'
                      : 'cursor-grab border-2 border-white/20 hover:border-indigo-400/60 shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.4)] hover:scale-105'
                  }`}
                >
                  <video
                    ref={isMyVideoLarge ? remoteVideoRef : myVideoRef}
                    autoPlay
                    muted={!isMyVideoLarge}
                    playsInline
                    className={`w-full h-full object-cover ${!isMyVideoLarge ? 'mirror' : ''}`}
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

                  {/* Name badge */}
                  <div className="absolute bottom-3 left-3 right-3 px-3 py-2 bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg">
                    <p className="text-white font-semibold text-xs truncate">{isMyVideoLarge ? 'Partner' : userName}</p>
                  </div>

                  {/* Drag indicator */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <div className="bg-black/60 backdrop-blur-xl rounded-full p-2 border border-white/20 shadow-lg">
                      <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Switch indicator */}
                  <div className="absolute top-3 right-3">
                    <div className="bg-gradient-to-br from-indigo-500/80 to-purple-500/80 backdrop-blur-xl rounded-full p-2 border border-white/30 shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </>
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
            title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
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
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
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
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
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
            title={isWhiteboardActive ? 'Close whiteboard' : 'Open whiteboard'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </button>

          <button
            onClick={leaveCall}
            className="group relative p-4 px-8 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-200 shadow-lg shadow-red-500/50 hover:shadow-red-500/70 active:scale-95 ml-2 flex items-center gap-3"
            title="End call"
          >
            <svg className="w-6 h-6 rotate-135" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
            <span className="font-semibold">End Call</span>
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
