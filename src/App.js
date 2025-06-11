import React, { useState, useRef } from 'react';
import './App.css';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const KYLO_IMAGES = [
  '1000007725.jpg',
  '1000007683.jpg',
  '1000007731.jpg',
  '1000007848.jpg',
  '1000007870.jpg',
  '1000007909.jpg',
  '1000007952.jpg',
];

function getRandomImage() {
  return KYLO_IMAGES[Math.floor(Math.random() * KYLO_IMAGES.length)];
}

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function App() {
  const [shuffledAlphabet, setShuffledAlphabet] = useState(() => shuffleArray(ALPHABET));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [kyloImage, setKyloImage] = useState(getRandomImage());
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const recognitionRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const tadaRef = useRef(null);
  const [countdownPercent, setCountdownPercent] = useState(100);
  const [speechPrimed, setSpeechPrimed] = useState(false);
  const [errorCooldown, setErrorCooldown] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');

  // Load voices and set default
  React.useEffect(() => {
    function loadVoices() {
      const voicesList = window.speechSynthesis.getVoices();
      setVoices(voicesList);
      // Pick a default: Google US English, then en-US, then first
      let best = voicesList.find(v => v.name.includes('Google') && v.lang === 'en-US');
      if (!best) best = voicesList.find(v => v.lang === 'en-US');
      if (!best) best = voicesList[0];
      if (best) setSelectedVoiceURI(best.voiceURI);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    // Prime speech synthesis to avoid first-click bug
    const prime = new window.SpeechSynthesisUtterance(' ');
    prime.volume = 0;
    window.speechSynthesis.speak(prime);
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Prime speech synthesis on first user interaction
  React.useEffect(() => {
    const handleFirstInteraction = () => {
      if (!speechPrimed) {
        const prime = new window.SpeechSynthesisUtterance(' ');
        prime.volume = 0;
        window.speechSynthesis.speak(prime);
        setSpeechPrimed(true);
      }
    };
    window.addEventListener('click', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction, { once: true });
    };
  }, [speechPrimed]);

  const currentLetter = shuffledAlphabet[currentIndex];
  // Filter voices to English only
  const englishVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  const selectedVoice = englishVoices.find(v => v.voiceURI === selectedVoiceURI);

  // Speech Synthesis: Say the letter
  const handleSayIt = () => {
    setMessage('');
    window.speechSynthesis.cancel();
    if (!voices.length) {
      setMessage('No voices available. Please reload the page or check your browser settings.');
      return;
    }
    if (!speechPrimed) {
      // Prime and then say the letter
      const prime = new window.SpeechSynthesisUtterance(' ');
      prime.volume = 0;
      window.speechSynthesis.speak(prime);
      setSpeechPrimed(true);
      setTimeout(() => handleSayIt(), 100);
      return;
    }
    const utter = new window.SpeechSynthesisUtterance(currentLetter);
    utter.rate = 0.7; // slightly faster, still clear for kids
    if (selectedVoice) {
      utter.voice = selectedVoice;
      console.log('Using selected voice:', selectedVoice);
    } else {
      console.log('No selected voice, using default.');
    }
    console.log('Utterance:', utter);
    window.speechSynthesis.speak(utter);
  };

  // Speech Recognition: Listen for the letter
  const handleTellMe = () => {
    if (errorCooldown) return;
    setMessage('Listening... Please say the letter!');
    // Log microphone info
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        console.log('Available microphones:', mics);
        if (mics.length > 0) {
          console.log('Default/active microphone:', mics[0]);
        } else {
          console.log('No microphones found.');
        }
      });
    } else {
      console.log('MediaDevices API not available.');
    }
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setMessage('Sorry, your browser does not support speech recognition.');
      return;
    }
    // Abort any previous recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognitionRef.current = recognition;
    const LISTEN_TIME = 4000; // 4 seconds
    setCountdownPercent(100);
    let start = Date.now();
    let countdownInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const percent = Math.max(0, 100 - (elapsed / LISTEN_TIME) * 100);
      setCountdownPercent(percent);
    }, 100);
    let listenTimeout = setTimeout(() => {
      clearInterval(countdownInterval);
      recognition.abort();
      setMessage("I didn't catch that. Try again!");
      setListening(false);
      setCountdownPercent(0);
      setErrorCooldown(true);
      setTimeout(() => {
        setMessage('');
        setErrorCooldown(false);
      }, 1500);
    }, LISTEN_TIME);
    recognition.start();
    recognition.onresult = (event) => {
      clearTimeout(listenTimeout);
      clearInterval(countdownInterval);
      setCountdownPercent(0);
      let said = event.results[0][0].transcript.trim().toUpperCase();
      setRawTranscript(said);
      const confidence = event.results[0][0].confidence;
      console.log('Raw transcript:', said, 'Confidence:', confidence);
      // Accept the letter or 'the letter X'
      const correctLetter = currentLetter.toUpperCase();
      const acceptedPhrases = [correctLetter, `THE LETTER ${correctLetter}`];
      if (acceptedPhrases.includes(said) || said[0] === correctLetter) {
        setMessage('Good job Kylo!');
        if (tadaRef.current) {
          tadaRef.current.currentTime = 0;
          tadaRef.current.play();
        }
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          setMessage('');
          setCurrentIndex((prev) => {
            if (prev + 1 >= shuffledAlphabet.length) {
              setShuffledAlphabet(shuffleArray(ALPHABET));
              setKyloImage(getRandomImage());
              return 0;
            } else {
              setKyloImage(getRandomImage());
              return prev + 1;
            }
          });
        }, 1500);
      } else {
        setMessage(`You said "${said}". Try again!`);
      }
      setListening(false);
    };
    recognition.onerror = (event) => {
      clearTimeout(listenTimeout);
      clearInterval(countdownInterval);
      setCountdownPercent(0);
      setMessage("I didn't catch that. Try again!");
      setListening(false);
      setErrorCooldown(true);
      setTimeout(() => {
        setMessage('');
        setErrorCooldown(false);
      }, 1500);
    };
    recognition.onend = () => {
      clearTimeout(listenTimeout);
      clearInterval(countdownInterval);
      setCountdownPercent(0);
      setListening(false);
    };
  };

  // Handler for Skip button
  const handleSkip = () => {
    setMessage('');
    setCurrentIndex((prev) => {
      if (prev + 1 >= shuffledAlphabet.length) {
        setShuffledAlphabet(shuffleArray(ALPHABET));
        setKyloImage(getRandomImage());
        return 0;
      } else {
        setKyloImage(getRandomImage());
        return prev + 1;
      }
    });
  };

  return (
    <div className="abc-app">
      {/* Listening indicator */}
      {listening && (
        <div className="listening-indicator">
          <span className="mic-icon" role="img" aria-label="Listening">🎤</span>
          <span className="listening-text">Listening...</span>
          <div className="listening-progress-bar">
            <div className="listening-progress" style={{ width: `${countdownPercent}%` }} />
          </div>
          <span className="listening-seconds">{Math.ceil(countdownPercent * 0.04)}</span>
        </div>
      )}
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="confetti-overlay">
          {/* Simple confetti effect: emoji burst */}
          <span style={{ fontSize: '7rem', animation: 'pop 1.2s' }}>🎉🎊✨</span>
        </div>
      )}
      {/* Main row layout */}
      <div className="main-row">
        <div className="main-title-left">Learning ABC's</div>
        <div className="main-center">
          <div className="kylo-image-container">
            <img
              src={`/${kyloImage}`}
              alt="Kylo"
              className="kylo-photo"
            />
          </div>
          <div className="letter-card">
            <span className="big-letter">{currentLetter}</span>
          </div>
          <div className="button-row">
            <button className="abc-btn say-it" onClick={handleSayIt} disabled={listening}>
              Say it
            </button>
            <button className="abc-btn tell-me" onClick={handleTellMe} disabled={listening || errorCooldown}>
              Tell me!
            </button>
            <button className="abc-btn skip-btn" onClick={handleSkip} disabled={listening}>
              Skip
            </button>
          </div>
          <div className="message-area">{message}</div>
          {rawTranscript && (
            <div className="debug-transcript">Heard: "{rawTranscript}"</div>
          )}
        </div>
        <div className="main-title-right">
          with Kylo
          <div className="made-by-dad-inline">made by Dad!</div>
        </div>
      </div>
      <button
        className="settings-toggle"
        onClick={() => setShowSettings(true)}
        style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}
      >
        Momma's Settings
      </button>
      {showSettings && (
        <div className="settings-panel">
          <button
            className="settings-close"
            onClick={() => setShowSettings(false)}
            style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: '1.7rem', color: '#1976d2', cursor: 'pointer', fontWeight: 'bold', zIndex: 1200 }}
            aria-label="Close settings"
          >
            ×
          </button>
          <div className="voice-select-row">
            <label htmlFor="voice-select" className="voice-label">Choose a voice: </label>
            <select
              id="voice-select"
              className="voice-select"
              value={selectedVoiceURI}
              onChange={e => setSelectedVoiceURI(e.target.value)}
            >
              {englishVoices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              className="abc-btn reset-speech"
              style={{ fontSize: '1rem', padding: '8px 16px', marginLeft: '16px', background: '#fff176', color: '#1976d2', border: '2px solid #4fc3f7', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => window.speechSynthesis.cancel()}
            >
              Reset Speech
            </button>
          </div>
        </div>
      )}
      <audio ref={tadaRef} src="/tada.mp3" preload="auto" />
    </div>
  );
}

export default App;
