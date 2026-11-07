import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredDocument = {
  id: string;
  name: string;
  createdAt: string;
};

export type StoredChunk = {
  id: string;
  documentId: string;
  documentName: string;
  heading: string;
  text: string;
  embedding: number[];
};

type Library = {
  documents: StoredDocument[];
  chunks: StoredChunk[];
};

const emptyLibrary = (): Library => ({ documents: [], chunks: [] });

function libraryPath() {
  return path.join(process.cwd(), "data", "library.json");
}

export async function readLibrary(): Promise<Library> {
  try {
    const raw = await readFile(libraryPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("documents" in parsed) ||
      !("chunks" in parsed) ||
      !Array.isArray(parsed.documents) ||
      !Array.isArray(parsed.chunks)
    ) {
      return emptyLibrary();
    }
    return {
      documents: parsed.documents as StoredDocument[],
      chunks: parsed.chunks as StoredChunk[],
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyLibrary();
    }
    throw error;
  }
}

let writeChain: Promise<unknown> = Promise.resolve();

export function updateLibrary(
  mutate: (library: Library) => Library,
): Promise<Library> {
  const run = writeChain.then(async () => {
    const library = mutate(await readLibrary());
    const file = libraryPath();
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(library));
    await rename(temporary, file);
    return library;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
