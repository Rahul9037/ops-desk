export type SourceRef = {
  label: string;
  documentName: string;
  heading: string;
  text: string;
};

export type OpsMetadata = {
  citations?: SourceRef[];
};

export const NO_SOURCE_REPLY = "I don't have a source for that.";
