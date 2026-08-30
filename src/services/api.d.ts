export function fetchCandidates(): Promise<any>;
export function createCandidate(candData: any): Promise<any>;
export function importCandidatesExcel(file: File, clearExisting?: boolean): Promise<any>;
export function fetchQuestions(): Promise<any>;
export function createQuestion(qData: any): Promise<any>;
export function createSession(sessionData: any): Promise<any>;
export function uploadRecordingTake(payload: {
  sessionId: string;
  questionId: string;
  audioBlob?: Blob;
  durationSec?: number;
  notes?: string;
  manualTranscript?: string;
}): Promise<any>;
export function uploadFullSessionRecording(payload: {
  sessionId: string;
  audioBlob?: Blob;
  durationSec?: number;
}): Promise<any>;
export function resetDatabase(password: string): Promise<any>;
export function getExcelExportUrl(candidateId?: string): string;
