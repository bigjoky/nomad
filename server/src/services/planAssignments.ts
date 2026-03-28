import { db } from '../db/database';
import { AssignmentRow, Tag, Participant } from '../types';
import { loadTagsByPlaceIds, loadParticipantsByAssignmentIds, formatAssignmentWithPlace } from './queryHelpers';

function getAssignmentRow(assignmentId: number): AssignmentRow | undefined {
  return db.prepare(`
    SELECT da.*, p.id as place_id, p.name as place_name, p.description as place_description,
      p.lat, p.lng, p.address, p.category_id, p.price, p.currency as place_currency,
      COALESCE(da.assignment_time, p.place_time) as place_time,
      COALESCE(da.assignment_end_time, p.end_time) as end_time,
      p.duration_minutes, p.notes as place_notes,
      p.image_url, p.transport_mode, p.google_place_id, p.website, p.phone,
      c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM day_assignments da
    JOIN places p ON da.place_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE da.id = ?
  `).get(assignmentId) as AssignmentRow | undefined;
}

export function getAssignmentWithPlace(assignmentId: number) {
  const assignment = getAssignmentRow(assignmentId);
  if (!assignment) return null;

  const tagsByPlaceId = loadTagsByPlaceIds([assignment.place_id], { compact: true });
  const participantsByAssignment = loadParticipantsByAssignmentIds([assignment.id]);

  return formatAssignmentWithPlace(
    assignment,
    (tagsByPlaceId[assignment.place_id] || []) as Partial<Tag>[],
    (participantsByAssignment[assignment.id] || []) as Participant[]
  );
}

export function ensurePlanAssignment(params: {
  tripId: number;
  dayId?: number | null;
  placeId?: number | null;
  preferredAssignmentId?: number | null;
}) {
  const { tripId } = params;
  let { dayId, placeId, preferredAssignmentId } = params;

  if (preferredAssignmentId) {
    const linked = db.prepare(`
      SELECT da.id, da.day_id, da.place_id
      FROM day_assignments da
      JOIN days d ON da.day_id = d.id
      WHERE da.id = ? AND d.trip_id = ?
    `).get(preferredAssignmentId, tripId) as { id: number; day_id: number; place_id: number } | undefined;

    if (linked) {
      const assignment = getAssignmentWithPlace(linked.id);
      if (assignment) return { assignment, created: false };
    }
  }

  if (!dayId || !placeId) return null;

  const day = db.prepare('SELECT id FROM days WHERE id = ? AND trip_id = ?').get(dayId, tripId);
  if (!day) throw new Error('Day not found');

  const place = db.prepare('SELECT id FROM places WHERE id = ? AND trip_id = ?').get(placeId, tripId);
  if (!place) throw new Error('Place not found');

  const existing = db.prepare(`
    SELECT da.id
    FROM day_assignments da
    JOIN days d ON da.day_id = d.id
    WHERE da.day_id = ? AND da.place_id = ? AND d.trip_id = ?
    ORDER BY da.order_index ASC, da.created_at ASC
    LIMIT 1
  `).get(dayId, placeId, tripId) as { id: number } | undefined;

  if (existing) {
    const assignment = getAssignmentWithPlace(existing.id);
    if (assignment) return { assignment, created: false };
  }

  const maxOrder = db.prepare('SELECT MAX(order_index) as max FROM day_assignments WHERE day_id = ?').get(dayId) as { max: number | null };
  const orderIndex = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  const result = db.prepare(
    'INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)'
  ).run(dayId, placeId, orderIndex);

  const assignment = getAssignmentWithPlace(Number(result.lastInsertRowid));
  if (!assignment) return null;

  return { assignment, created: true };
}
