declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: string | undefined;
  }
}

interface Navigator {
  contacts?: {
    select: (properties: string[], options?: { multiple: boolean }) => Promise<any[]>;
  };
}
