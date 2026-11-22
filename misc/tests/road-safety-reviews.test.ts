import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roadSafetyReviewInput,
  roadSafetyReviewsBoundsSchema,
} from "../../frontend/src/lib/road-safety-reviews.ts";

test("roadSafetyReviewInput validates ratings, Goa bounds, and comment lengths", () => {
  // Valid review with comment
  const valid = roadSafetyReviewInput.safeParse({
    lat: 15.4989,
    lng: 73.8278,
    safety_rating: 4,
    comment: "Good road lighting and wide shoulder near Panjim.",
  });
  assert.ok(valid.success);
  if (valid.success) {
    assert.equal(valid.data.safety_rating, 4);
    assert.equal(valid.data.comment, "Good road lighting and wide shoulder near Panjim.");
  }

  // Valid review without comment
  const noComment = roadSafetyReviewInput.safeParse({
    lat: 15.2,
    lng: 73.9,
    safety_rating: 5,
  });
  assert.ok(noComment.success);

  // Rating boundaries (1-5)
  assert.ok(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.9, safety_rating: 1 }).success);
  assert.ok(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.9, safety_rating: 5 }).success);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.9, safety_rating: 0 }).success, false);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.9, safety_rating: 6 }).success, false);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.9, safety_rating: 3.5 }).success, false);

  // Goa bounds (lat 14.8 to 15.9, lng 73.6 to 74.4)
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 14.7, lng: 73.9, safety_rating: 4 }).success, false);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 16.0, lng: 73.9, safety_rating: 4 }).success, false);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 73.5, safety_rating: 4 }).success, false);
  assert.equal(roadSafetyReviewInput.safeParse({ lat: 15.2, lng: 74.5, safety_rating: 4 }).success, false);

  // Comment max 280 characters
  assert.ok(
    roadSafetyReviewInput.safeParse({
      lat: 15.2,
      lng: 73.9,
      safety_rating: 3,
      comment: "A".repeat(280),
    }).success,
  );
  assert.equal(
    roadSafetyReviewInput.safeParse({
      lat: 15.2,
      lng: 73.9,
      safety_rating: 3,
      comment: "A".repeat(281),
    }).success,
    false,
  );
});

test("roadSafetyReviewsBoundsSchema accepts optional viewport bounding box", () => {
  const empty = roadSafetyReviewsBoundsSchema.safeParse({});
  assert.ok(empty.success);

  const bounded = roadSafetyReviewsBoundsSchema.safeParse({
    minLat: 15.0,
    maxLat: 15.6,
    minLng: 73.7,
    maxLng: 74.1,
  });
  assert.ok(bounded.success);
});
