import React, { createContext, useReducer, useContext, Dispatch } from 'react';

// Type definition for the connector state
interface ConnectorState {
  current_scene: string;
  user_command: string | null;
}

// Type definition for the connector actions
type ConnectorAction =
  | { type: 'SET_SCENE'; scene: string }
  | { type: 'SET_COMMAND'; command: string | null };

// Initial state for the connector
const initial_state: ConnectorState = {
  current_scene: 'default_scene',
  user_command: null,
};

// Reducer function to handle state updates
const connectorReducer = (state: ConnectorState, action: ConnectorAction): ConnectorState => {
  switch (action.type) {
    case 'SET_SCENE':
      return { ...state, current_scene: action.scene };
    case 'SET_COMMAND':
      return { ...state, user_command: action.command };
    default:
      return state;
  }
};

// Type definition for the context value
interface ConnectorContextValue {
  state: ConnectorState;
  dispatch: Dispatch<ConnectorAction>;
}

interface ConnectorProviderProps {
  children: React.ReactNode;
}

// Defining the context with an initial undefined value
const ConnectorContext = createContext<ConnectorContextValue | undefined>(undefined);

// Connector Provider to wrap the components
const ConnectorProvider: React.FC<ConnectorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(connectorReducer, initial_state);

  return (
    <ConnectorContext.Provider value={{ state, dispatch }}>
      {children}
    </ConnectorContext.Provider>
  );
};


// Custom hook to use the connector context
const useConnector = (): ConnectorContextValue => {
  const context = useContext(ConnectorContext);
  if (!context) {
    throw new Error('useConnector must be used within a ConnectorProvider');
  }
  return context;
};

export { ConnectorProvider, useConnector };
