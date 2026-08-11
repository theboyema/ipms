import {
  collection, doc, addDoc, getDocs, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  Timestamp, writeBatch, limit as fsLimit,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubmissionStage =
  | 'PROPOSAL' | 'CHAPTER_1' | 'CHAPTER_2' | 'CHAPTER_3' | 'CHAPTER_4' | 'CHAPTER_5' | 'FINAL_REPORT';

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REVISION_REQUIRED';

export interface Submission {
  id: string;
  chainId: string;
  studentId: string;
  supervisorId: string;
  stage: SubmissionStage;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string;   // base64 from FileReader — only present locally before upload
  fileUrl: string;    // Firebase Storage download URL — use this for preview/download
  version: number;
  status: SubmissionStatus;
  createdAt: string;
}

export interface Review {
  id: string;
  submissionId: string;
  supervisorId: string;
  status: SubmissionStatus;
  remarks: string;
  reviewedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'SUBMISSION' | 'REVIEW' | 'ASSIGNMENT' | 'MESSAGE';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachment?: { name: string; type: string; data: string };
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface Meeting {
  id: string;
  supervisorId: string;
  studentId: string;
  supervisorName: string;
  studentName: string;
  title: string;
  scheduledAt: string;
  location: string;
  agenda: string;
  status: MeetingStatus;
  outcome: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return new Date().toISOString();
}

function subDoc(d: any): Submission {
  const data = d.data();
  return {
    id: d.id,
    chainId:      data.chainId,
    studentId:    data.studentId,
    supervisorId: data.supervisorId,
    stage:        data.stage,
    title:        data.title,
    fileName:     data.fileName,
    fileSize:     data.fileSize,
    fileType:     data.fileType,
    version:      data.version,
    status:       data.status,
    createdAt:    toISO(data.createdAt),
    fileUrl:      data.fileUrl ?? '',
    fileData:     '',
  };
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export const getSubmissions = async (): Promise<Submission[]> => {
  const snap = await getDocs(query(collection(db, 'submissions'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => subDoc(d));
};

export const getStudentSubmissions = async (studentId: string): Promise<Submission[]> => {
  const snap = await getDocs(
    query(collection(db, 'submissions'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => subDoc(d));
};

export const getSupervisorSubmissions = async (supervisorId: string): Promise<Submission[]> => {
  const snap = await getDocs(
    query(collection(db, 'submissions'), where('supervisorId', '==', supervisorId), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => subDoc(d));
};

export const getSubmissionChain = async (chainId: string): Promise<Submission[]> => {
  const snap = await getDocs(
    query(collection(db, 'submissions'), where('chainId', '==', chainId), orderBy('version', 'asc'))
  );
  return snap.docs.map(d => subDoc(d));
};

async function uploadToCloudinary(fileData: string, fileName: string, fileType: string): Promise<string> {
  const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  // PDFs can be uploaded as 'image' so Cloudinary serves them inline for preview.
  // Everything else (DOCX, etc.) goes as 'raw'.
  const resourceType = fileType === 'application/pdf' ? 'image' : 'raw';

  const blob = await fetch(fileData).then(r => r.blob());
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || 'File upload failed. Check Cloudinary credentials.');
  }
  const json = await res.json();
  return json.secure_url as string;
}

export const createSubmission = async (
  data: Omit<Submission, 'id' | 'createdAt' | 'fileUrl'>,
): Promise<Submission> => {
  const { fileData, ...rest } = data;

  const fileUrl = await uploadToCloudinary(fileData, data.fileName, data.fileType);

  const ref = await addDoc(collection(db, 'submissions'), {
    ...rest, fileUrl, createdAt: serverTimestamp(),
  });

  return { id: ref.id, ...data, fileUrl, fileData: '', createdAt: new Date().toISOString() };
};

// Real-time subscriptions for submission lists
// orderBy removed — composite indexes may not be deployed; sorted client-side instead
export const subscribeStudentSubmissions = (
  studentId: string,
  cb: (subs: Submission[]) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'submissions'), where('studentId', '==', studentId)),
    snap => cb(
      snap.docs.map(d => subDoc(d))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    ),
    err => console.error('[store] subscribeStudentSubmissions:', err),
  );

export const subscribeSupervisorSubmissions = (
  supervisorId: string,
  cb: (subs: Submission[]) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'submissions'), where('supervisorId', '==', supervisorId)),
    snap => cb(
      snap.docs.map(d => subDoc(d))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    ),
    err => console.error('[store] subscribeSupervisorSubmissions:', err),
  );

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const getReviewForSubmission = async (submissionId: string): Promise<Review | undefined> => {
  const snap = await getDocs(
    query(collection(db, 'reviews'), where('submissionId', '==', submissionId))
  );
  if (snap.empty) return undefined;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), reviewedAt: toISO(d.data().reviewedAt) } as Review;
};

export const saveReview = async (data: Omit<Review, 'id'>): Promise<Review> => {
  const snap = await getDocs(
    query(collection(db, 'reviews'), where('submissionId', '==', data.submissionId))
  );
  const batch = writeBatch(db);
  let reviewId: string;

  if (!snap.empty) {
    reviewId = snap.docs[0].id;
    batch.update(doc(db, 'reviews', reviewId), { ...data, reviewedAt: serverTimestamp() });
  } else {
    const newRef = doc(collection(db, 'reviews'));
    reviewId = newRef.id;
    batch.set(newRef, { ...data, reviewedAt: serverTimestamp() });
  }

  // Mirror status onto the submission document
  batch.update(doc(db, 'submissions', data.submissionId), { status: data.status });
  await batch.commit();

  return { id: reviewId, ...data };
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'), fsLimit(50))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toISO(d.data().createdAt) } as Notification));
};

export const countUnread = async (userId: string): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false))
  );
  return snap.size;
};

export const pushNotification = async (
  data: Omit<Notification, 'id' | 'read' | 'createdAt'>,
): Promise<void> => {
  await addDoc(collection(db, 'notifications'), { ...data, read: false, createdAt: serverTimestamp() });
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', id), { read: true });
};

export const markAllRead = async (userId: string): Promise<void> => {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false))
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// Real-time subscriptions for notifications
// orderBy + limit removed to avoid composite-index requirement; sorted client-side
export const subscribeNotifications = (
  userId: string,
  cb: (notifs: Notification[]) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', userId)),
    snap => cb(
      snap.docs
        .map(d => ({ id: d.id, ...d.data(), createdAt: toISO(d.data().createdAt) } as Notification))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50)
    ),
    err => console.error('[store] subscribeNotifications:', err),
  );

export const subscribeUnreadCount = (
  userId: string,
  cb: (count: number) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false)),
    snap => cb(snap.size),
    err => console.error('[store] subscribeUnreadCount:', err),
  );

// ─── Messages ─────────────────────────────────────────────────────────────────

export const getMessages = async (userA: string, userB: string): Promise<Message[]> => {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('participants', 'array-contains', userA), orderBy('timestamp', 'asc'))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data(), timestamp: toISO(d.data().timestamp) }) as Message & { participants: string[] })
    .filter(m => m.participants.includes(userB))
    .map(({ participants: _p, ...m }) => m as Message);
};

export const getUnreadMsgCount = async (userId: string): Promise<number> => {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('receiverId', '==', userId), where('read', '==', false))
  );
  return snap.size;
};

export const getConversationPeers = async (userId: string): Promise<string[]> => {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('participants', 'array-contains', userId))
  );
  const peers = new Set<string>();
  snap.docs.forEach(d => {
    const data = d.data();
    peers.add(data.senderId === userId ? data.receiverId : data.senderId);
  });
  return Array.from(peers);
};

export const sendMessage = async (
  data: Omit<Message, 'id' | 'timestamp' | 'read'>,
): Promise<Message> => {
  let payload = { ...data };

  // Upload attachment to Cloudinary so base64 never touches Firestore (1 MB doc limit)
  if (payload.attachment?.data && payload.attachment.data.startsWith('data:')) {
    const { name, type, data: b64 } = payload.attachment;
    const resourceType = type.startsWith('image/') ? 'image' : type === 'application/pdf' ? 'image' : 'raw';
    const url = await uploadToCloudinary(b64, name, type);
    payload = { ...payload, attachment: { name, type, data: url } };
  }

  const ref = await addDoc(collection(db, 'messages'), {
    ...payload,
    participants: [data.senderId, data.receiverId],
    read: false,
    timestamp: serverTimestamp(),
  });
  return { id: ref.id, ...payload, timestamp: new Date().toISOString(), read: false };
};

export const markMessagesRead = async (myId: string, peerId: string): Promise<void> => {
  const snap = await getDocs(
    query(collection(db, 'messages'), where('senderId', '==', peerId), where('receiverId', '==', myId), where('read', '==', false))
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
};

// Real-time subscriptions for messages
// orderBy removed to avoid composite-index requirement; sorted client-side
export const subscribeMessages = (
  userA: string,
  userB: string,
  cb: (msgs: Message[]) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'messages'), where('participants', 'array-contains', userA)),
    snap => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data(), timestamp: toISO(d.data().timestamp) }) as Message & { participants: string[] })
        .filter(m => m.participants.includes(userB))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(({ participants: _p, ...m }) => m as Message);
      cb(msgs);
    },
    err => console.error('[store] subscribeMessages:', err),
  );

// All messages involving a user — used by supervisor's conversation sidebar
export const subscribeAllMessagesForUser = (
  userId: string,
  cb: (msgs: (Message & { participants: string[] })[]) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'messages'), where('participants', 'array-contains', userId)),
    snap => {
      cb(
        snap.docs
          .map(d => ({ id: d.id, ...d.data(), timestamp: toISO(d.data().timestamp) }) as Message & { participants: string[] })
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      );
    },
    err => console.error('[store] subscribeAllMessagesForUser:', err),
  );

export const subscribeUnreadMsgCount = (
  userId: string,
  cb: (count: number) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, 'messages'), where('receiverId', '==', userId), where('read', '==', false)),
    snap => cb(snap.size),
    err => console.error('[store] subscribeUnreadMsgCount:', err),
  );

// ─── Meetings ─────────────────────────────────────────────────────────────────

function meetingDoc(d: any): Meeting {
  const data = d.data();
  return {
    id: d.id,
    supervisorId:   data.supervisorId   ?? '',
    studentId:      data.studentId      ?? '',
    supervisorName: data.supervisorName ?? '',
    studentName:    data.studentName    ?? '',
    title:          data.title          ?? '',
    scheduledAt:    toISO(data.scheduledAt),
    location:       data.location       ?? '',
    agenda:         data.agenda         ?? '',
    status:         data.status         ?? 'SCHEDULED',
    outcome:        data.outcome        ?? '',
    createdAt:      toISO(data.createdAt),
  };
}

export const addMeeting = async (data: Omit<Meeting, 'id' | 'createdAt'>): Promise<Meeting> => {
  const ref = await addDoc(collection(db, 'meetings'), { ...data, createdAt: serverTimestamp() });
  return { id: ref.id, ...data, createdAt: new Date().toISOString() };
};

export const updateMeeting = async (id: string, data: Partial<Omit<Meeting, 'id'>>): Promise<void> => {
  await updateDoc(doc(db, 'meetings', id), data);
};

export const subscribeMeetings = (
  userId: string,
  role: 'supervisor' | 'student',
  cb: (meetings: Meeting[]) => void,
): (() => void) => {
  const field = role === 'supervisor' ? 'supervisorId' : 'studentId';
  return onSnapshot(
    query(collection(db, 'meetings'), where(field, '==', userId)),
    snap => cb(
      snap.docs.map(d => meetingDoc(d))
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    ),
    err => console.error('[store] subscribeMeetings:', err),
  );
};

export const getAllMeetings = async (): Promise<Meeting[]> => {
  const snap = await getDocs(collection(db, 'meetings'));
  return snap.docs.map(d => meetingDoc(d))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
};

export const getAllReviews = async (): Promise<Review[]> => {
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs.map(d => ({ id: d.id, ...d.data(), reviewedAt: toISO(d.data().reviewedAt) } as Review));
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const addAudit = async (entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> => {
  await addDoc(collection(db, 'audit'), { ...entry, timestamp: serverTimestamp() });
};

export const getAuditLog = async (): Promise<AuditEntry[]> => {
  const snap = await getDocs(
    query(collection(db, 'audit'), orderBy('timestamp', 'desc'), fsLimit(500))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: toISO(d.data().timestamp) } as AuditEntry));
};

// ─── Constants & Formatters ───────────────────────────────────────────────────

export const STAGES: SubmissionStage[] = [
  'PROPOSAL', 'CHAPTER_1', 'CHAPTER_2', 'CHAPTER_3', 'CHAPTER_4', 'CHAPTER_5', 'FINAL_REPORT',
];

export const STAGE_LABELS: Record<SubmissionStage, string> = {
  PROPOSAL:     'Proposal',
  CHAPTER_1:    'Chapter 1',
  CHAPTER_2:    'Chapter 2',
  CHAPTER_3:    'Chapter 3',
  CHAPTER_4:    'Chapter 4',
  CHAPTER_5:    'Chapter 5',
  FINAL_REPORT: 'Final Report',
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

export const fmtFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Route Cloudinary URLs through the server-side proxy (avoids CDN auth restrictions)
export const proxyUrl = (fileUrl: string) =>
  fileUrl.includes('res.cloudinary.com')
    ? `/api/file?url=${encodeURIComponent(fileUrl)}`
    : fileUrl;

// Cross-origin download: fetch via proxy → blob → local object URL → trigger download.
export const downloadFile = async (fileUrl: string, fileName: string): Promise<void> => {
  const fetchUrl = proxyUrl(fileUrl);
  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    window.open(fileUrl, '_blank', 'noopener');
  }
};
