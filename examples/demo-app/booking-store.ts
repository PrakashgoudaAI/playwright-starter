import { randomUUID } from 'node:crypto';

export const participantNames = Object.freeze({ alice: 'Alice', 'alice-jones': 'Alice Jones', bob: 'Bob', evan: 'Evan' });
export type Participant = keyof typeof participantNames;
export type BookingInput = { title: string; startDate: string; participants: Participant[] };
export type Booking = BookingInput & { id: string; reference: string };

export class BookingProblem extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'BookingProblem';
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

export function parseBooking(value: unknown): BookingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookingProblem(400, 'Use a booking object.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !['title', 'startDate', 'participants'].includes(key))) {
    throw new BookingProblem(400, 'Unexpected booking field.');
  }
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 80) {
    throw new BookingProblem(400, 'Use a booking title of 1–80 characters.');
  }
  if (typeof data.startDate !== 'string' || !validDate(data.startDate) ||
      data.startDate < '2028-01-01' || data.startDate > '2029-12-31' || data.startDate === '2028-02-14') {
    throw new BookingProblem(400, 'Choose an available date in the 2028–2029 demo window.');
  }
  const people = data.participants;
  if (!Array.isArray(people) || people.length < 1 || people.length > 3 || new Set(people).size !== people.length ||
      people.some(person => typeof person !== 'string' || !Object.hasOwn(participantNames, person) || person === 'evan')) {
    throw new BookingProblem(400, 'Choose 1–3 distinct available participants.');
  }
  return { title: data.title.trim(), startDate: data.startDate, participants: [...people].sort() as Participant[] };
}

function copy(booking: Booking): Booking { return { ...booking, participants: [...booking.participants] }; }

/** One store per authenticated session. In-memory demo, not a distributed persistence layer. */
export class BookingStore {
  private readonly records = new Map<string, Booking>();
  private readonly requests = new Map<string, { fingerprint: string; id: string }>();

  create(value: unknown, key: string): { booking: Booking; replay: boolean } {
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(key)) throw new BookingProblem(400, 'Use an idempotency key of 16–80 safe characters.');
    const input = parseBooking(value);
    const fingerprint = JSON.stringify(input);
    const previous = this.requests.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new BookingProblem(409, 'Request key was already used for a different booking.');
      return { booking: copy(this.records.get(previous.id)!), replay: true };
    }
    if (this.records.size >= 100) throw new BookingProblem(409, 'Demo booking capacity reached.');
    const booking: Booking = { ...input, id: randomUUID(), reference: 'BK-' + String(this.records.size + 1).padStart(3, '0') };
    // No await between checking the key and recording both entries in this single-process demo.
    this.records.set(booking.id, booking);
    this.requests.set(key, { fingerprint, id: booking.id });
    return { booking: copy(booking), replay: false };
  }

  get(id: string): Booking | undefined {
    const booking = this.records.get(id);
    return booking ? copy(booking) : undefined;
  }

  list(page: number, pageSize: number) {
    if (!Number.isInteger(page) || page < 1 || page > 100 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 10) {
      throw new BookingProblem(400, 'Use page 1–100 and pageSize 1–10.');
    }
    const all = [...this.records.values()];
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    if (page > totalPages) throw new BookingProblem(400, 'Page is outside the result set.');
    return { bookings: all.slice((page - 1) * pageSize, page * pageSize).map(copy), page, totalPages, total: all.length };
  }
}
