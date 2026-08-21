/// <reference types="vite/client" />

interface Window {
  __MC_REACT_MOUNTED__?: boolean;
  __MC_RECOVER__?: () => Promise<void>;
}
