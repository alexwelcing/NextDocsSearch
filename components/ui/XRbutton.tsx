import React, { useState, useEffect } from 'react';

const XRButton = ({
  mode = 'inline',
  sessionInit = {},
  enterOnly = false,
  exitOnly = false,
  onError = (error) => console.error(error),
  children
}) => {
  const [status, setStatus] = useState('Init');
  const [xrSession, setXrSession] = useState(null);

  useEffect(() => {
    if (enterOnly && exitOnly) {
      console.warn('Both enterOnly and exitOnly are set to true. This might not be the intended behavior.');
    }
  }, [enterOnly, exitOnly]);

  const startXR = async () => {
    try {
      const session = await navigator.xr.requestSession(mode, sessionInit);
      setXrSession(session);
      setStatus('Started');

      session.addEventListener('end', () => {
        setXrSession(null);
        setStatus('Ended');
      });
    } catch (error) {
      onError(error);
    }
  };

  const endXR = () => {
    if (xrSession) {
      xrSession.end();
    }
  };

  return (
    <div>
      {(!exitOnly && (!xrSession || status === 'Ended')) && (
        <button onClick={startXR}>
          {children(status)}
        </button>
      )}

      {(!enterOnly && xrSession && status === 'Started') && (
        <button onClick={endXR}>
          Exit WebXR
        </button>
      )}
    </div>
  );
};

export default XRButton;
