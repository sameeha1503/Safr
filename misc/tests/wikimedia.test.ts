import assert from "node:assert/strict";
import test from "node:test";

import {
  imageTitleMatchScore,
  lookupWikimediaImage,
} from "../../frontend/src/lib/wikimedia.server.ts";

test("Commons image titles must contain the complete place name", () => {
  assert.equal(imageTitleMatchScore("Baga Beach", "File:Baga Beach, Goa.jpg"), 1);
  assert.equal(
    imageTitleMatchScore("Dudhsagar Waterfalls", "File:Dudhsagar Waterfall panorama.jpg"),
    1,
  );
  assert.equal(imageTitleMatchScore("Chapora Fort", "File:Chapora river.jpg"), 0.5);
  assert.equal(imageTitleMatchScore("Fort Aguada", "File:Fort Aguada map.svg"), 0);
});

test("Commons lookup returns a matched bitmap with an attribution page", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.ok(init.signal);
    return Response.json({
      query: {
        pages: {
          "1": {
            index: 2,
            title: "File:Unrelated Goa sunset.jpg",
            imageinfo: [
              {
                thumburl: "https://upload.wikimedia.org/unrelated.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Unrelated.jpg",
                mime: "image/jpeg",
              },
            ],
          },
          "2": {
            index: 1,
            title: "File:Fixture Beach Goa.jpg",
            imageinfo: [
              {
                thumburl: "https://upload.wikimedia.org/fixture.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Fixture_Beach_Goa.jpg",
                mime: "image/jpeg",
              },
            ],
          },
        },
      },
    });
  });
  const media = await lookupWikimediaImage({ name: "Fixture Beach" });
  assert.equal(media?.imageUrl, "https://upload.wikimedia.org/fixture.jpg");
  assert.match(media?.credit.label ?? "", /license and attribution/i);
});

test("Commons lookup fails soft when no safe title match exists", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      query: {
        pages: {
          "1": {
            title: "File:Different beach in Goa.jpg",
            imageinfo: [
              {
                url: "https://upload.wikimedia.org/different.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Different.jpg",
                mime: "image/jpeg",
              },
            ],
          },
        },
      },
    }),
  );
  assert.equal(await lookupWikimediaImage({ name: "Missing Landmark Unique" }), null);
});
