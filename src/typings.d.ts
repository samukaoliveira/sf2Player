
interface MIDIAccess extends EventTarget {
  readonly inputs: Map<string, MIDIInput>;
  readonly outputs: Map<string, MIDIOutput>;
  onstatechange: ((event: Event) => void) | null;
}

interface MIDIInput extends EventTarget {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly state: string;
  onmidimessage:
    | ((event: MIDIMessageEvent) => void)
    | null;
}

interface MIDIOutput extends EventTarget {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly state: string;
}

interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array;
  readonly receivedTime: number;
}

interface Navigator {
  requestMIDIAccess(
    options?: { sysex?: boolean }
  ): Promise<MIDIAccess>;
}

interface Window {
  sf2LocalCache?: {
    read(url: string): Promise<Uint8Array | null>;
    write(url: string, bytes: ArrayBuffer): Promise<boolean>;
    listLocal(): Promise<{ nome: string; categoria: string }[]>;
    readLocal(nome: string): Promise<Uint8Array | null>;
    importLocal(
      nome: string,
      categoria: string,
      bytes: ArrayBuffer
    ): Promise<{ sucesso: boolean; erro?: string }>;
    readScenes(): Promise<string | null>;
    writeScenes(conteudo: string): Promise<boolean>;
    directory: string;
  };
}
