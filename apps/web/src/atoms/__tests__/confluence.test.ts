import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  confluenceAtom,
  ConfluencePage,
  ConfluenceState,
  ConfluenceStatus,
} from "../confluence";

describe("confluence atoms", () => {
  describe("confluenceAtom", () => {
    describe("initial state", () => {
      it("should have initial weeklyReportPageId of null", () => {
        const store = createStore();
        expect(store.get(confluenceAtom).weeklyReportPageId).toBeNull();
      });

      it("should have initial weeklyReportLoaded of false", () => {
        const store = createStore();
        expect(store.get(confluenceAtom).weeklyReportLoaded).toBe(false);
      });

      it("should have initial publishStatus of 'idle'", () => {
        const store = createStore();
        expect(store.get(confluenceAtom).publishStatus).toBe("idle");
      });

      it("should have initial publishedPage of null", () => {
        const store = createStore();
        expect(store.get(confluenceAtom).publishedPage).toBeNull();
      });

      it("should have initial errorMessage of null", () => {
        const store = createStore();
        expect(store.get(confluenceAtom).errorMessage).toBeNull();
      });

      it("should match the complete initial state object", () => {
        const store = createStore();
        const expectedInitialState: ConfluenceState = {
          weeklyReportPageId: null,
          weeklyReportLoaded: false,
          publishStatus: "idle",
          publishedPage: null,
          errorMessage: null,
        };
        expect(store.get(confluenceAtom)).toEqual(expectedInitialState);
      });
    });

    describe("weeklyReportPageId", () => {
      it("should store a page ID string", () => {
        const store = createStore();
        const pageId = "123456789";
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportPageId: pageId,
        });
        expect(store.get(confluenceAtom).weeklyReportPageId).toBe(pageId);
      });

      it("should allow resetting to null", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportPageId: "123456789",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportPageId: null,
        });
        expect(store.get(confluenceAtom).weeklyReportPageId).toBeNull();
      });
    });

    describe("weeklyReportLoaded", () => {
      it("should update to true when report is loaded", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportLoaded: true,
        });
        expect(store.get(confluenceAtom).weeklyReportLoaded).toBe(true);
      });

      it("should reset to false", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportLoaded: true,
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportLoaded: false,
        });
        expect(store.get(confluenceAtom).weeklyReportLoaded).toBe(false);
      });
    });

    describe("publishStatus transitions", () => {
      it("should transition from idle to uploading", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
        });
        expect(store.get(confluenceAtom).publishStatus).toBe("uploading");
      });

      it("should transition from uploading to uploaded", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploaded",
        });
        expect(store.get(confluenceAtom).publishStatus).toBe("uploaded");
      });

      it("should transition from uploading to error", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: "Upload failed",
        });
        expect(store.get(confluenceAtom).publishStatus).toBe("error");
        expect(store.get(confluenceAtom).errorMessage).toBe("Upload failed");
      });

      it("should allow resetting from error to idle", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: "Upload failed",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "idle",
          errorMessage: null,
        });
        expect(store.get(confluenceAtom).publishStatus).toBe("idle");
        expect(store.get(confluenceAtom).errorMessage).toBeNull();
      });

      it("should allow resetting from uploaded to idle", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploaded",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "idle",
        });
        expect(store.get(confluenceAtom).publishStatus).toBe("idle");
      });

      it("should accept all valid ConfluenceStatus values", () => {
        const store = createStore();
        const validStatuses: ConfluenceStatus[] = [
          "idle",
          "uploading",
          "uploaded",
          "error",
        ];

        for (const status of validStatuses) {
          store.set(confluenceAtom, {
            ...store.get(confluenceAtom),
            publishStatus: status,
          });
          expect(store.get(confluenceAtom).publishStatus).toBe(status);
        }
      });
    });

    describe("publishedPage", () => {
      it("should store a ConfluencePage object", () => {
        const store = createStore();
        const page: ConfluencePage = {
          id: "12345",
          title: "Weekly Meeting Notes - 2024-01-15",
          url: "https://confluence.example.com/pages/12345",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: page,
          publishStatus: "uploaded",
        });
        expect(store.get(confluenceAtom).publishedPage).toEqual(page);
      });

      it("should store page with Korean title", () => {
        const store = createStore();
        const page: ConfluencePage = {
          id: "98765",
          title: "주간회의록 - 제품기술팀",
          url: "https://confluence.example.com/pages/98765",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: page,
        });
        expect(store.get(confluenceAtom).publishedPage?.title).toBe(
          "주간회의록 - 제품기술팀"
        );
      });

      it("should allow resetting to null after upload", () => {
        const store = createStore();
        const page: ConfluencePage = {
          id: "12345",
          title: "Test Page",
          url: "https://confluence.example.com/pages/12345",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: page,
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: null,
        });
        expect(store.get(confluenceAtom).publishedPage).toBeNull();
      });

      it("should update existing published page", () => {
        const store = createStore();
        const page1: ConfluencePage = {
          id: "12345",
          title: "Old Title",
          url: "https://confluence.example.com/pages/12345",
        };
        const page2: ConfluencePage = {
          id: "12345",
          title: "Updated Title",
          url: "https://confluence.example.com/pages/12345",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: page1,
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishedPage: page2,
        });
        expect(store.get(confluenceAtom).publishedPage?.title).toBe(
          "Updated Title"
        );
      });
    });

    describe("errorMessage", () => {
      it("should store an error message string", () => {
        const store = createStore();
        const errorMsg = "Failed to upload: Network error";
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: errorMsg,
        });
        expect(store.get(confluenceAtom).errorMessage).toBe(errorMsg);
      });

      it("should store Korean error messages", () => {
        const store = createStore();
        const errorMsg = "Confluence 업로드 실패: 권한이 없습니다";
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: errorMsg,
        });
        expect(store.get(confluenceAtom).errorMessage).toBe(errorMsg);
      });

      it("should clear error message when resetting", () => {
        const store = createStore();
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: "Some error",
        });
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "idle",
          errorMessage: null,
        });
        expect(store.get(confluenceAtom).errorMessage).toBeNull();
      });
    });

    describe("complete state updates", () => {
      it("should handle complete upload flow", () => {
        const store = createStore();

        // Step 1: Set weekly report page ID
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          weeklyReportPageId: "weekly-123",
          weeklyReportLoaded: true,
        });

        // Step 2: Start uploading
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
        });

        // Step 3: Complete upload
        const publishedPage: ConfluencePage = {
          id: "minutes-456",
          title: "회의록 - 2024-01-15",
          url: "https://confluence.example.com/pages/minutes-456",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploaded",
          publishedPage,
        });

        const finalState = store.get(confluenceAtom);
        expect(finalState.weeklyReportPageId).toBe("weekly-123");
        expect(finalState.weeklyReportLoaded).toBe(true);
        expect(finalState.publishStatus).toBe("uploaded");
        expect(finalState.publishedPage).toEqual(publishedPage);
        expect(finalState.errorMessage).toBeNull();
      });

      it("should handle upload failure flow", () => {
        const store = createStore();

        // Start uploading
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
        });

        // Fail upload
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: "Confluence API error: 401 Unauthorized",
        });

        const finalState = store.get(confluenceAtom);
        expect(finalState.publishStatus).toBe("error");
        expect(finalState.errorMessage).toBe(
          "Confluence API error: 401 Unauthorized"
        );
        expect(finalState.publishedPage).toBeNull();
      });

      it("should handle retry after failure", () => {
        const store = createStore();

        // First attempt fails
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "error",
          errorMessage: "Network error",
        });

        // Retry: reset to uploading
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploading",
          errorMessage: null,
        });

        // Retry succeeds
        const page: ConfluencePage = {
          id: "789",
          title: "Retry Success",
          url: "https://confluence.example.com/pages/789",
        };
        store.set(confluenceAtom, {
          ...store.get(confluenceAtom),
          publishStatus: "uploaded",
          publishedPage: page,
        });

        const finalState = store.get(confluenceAtom);
        expect(finalState.publishStatus).toBe("uploaded");
        expect(finalState.publishedPage).toEqual(page);
        expect(finalState.errorMessage).toBeNull();
      });

      it("should reset entire state", () => {
        const store = createStore();

        // Set some state
        store.set(confluenceAtom, {
          weeklyReportPageId: "weekly-123",
          weeklyReportLoaded: true,
          publishStatus: "uploaded",
          publishedPage: {
            id: "456",
            title: "Test",
            url: "https://example.com",
          },
          errorMessage: null,
        });

        // Reset to initial state
        store.set(confluenceAtom, {
          weeklyReportPageId: null,
          weeklyReportLoaded: false,
          publishStatus: "idle",
          publishedPage: null,
          errorMessage: null,
        });

        const state = store.get(confluenceAtom);
        expect(state.weeklyReportPageId).toBeNull();
        expect(state.weeklyReportLoaded).toBe(false);
        expect(state.publishStatus).toBe("idle");
        expect(state.publishedPage).toBeNull();
        expect(state.errorMessage).toBeNull();
      });
    });

    describe("independent stores", () => {
      it("should not share state between stores", () => {
        const store1 = createStore();
        const store2 = createStore();

        store1.set(confluenceAtom, {
          ...store1.get(confluenceAtom),
          weeklyReportPageId: "store1-page",
          publishStatus: "uploaded",
        });

        // store2 should still have initial state
        expect(store2.get(confluenceAtom).weeklyReportPageId).toBeNull();
        expect(store2.get(confluenceAtom).publishStatus).toBe("idle");

        // store1 should have updated state
        expect(store1.get(confluenceAtom).weeklyReportPageId).toBe(
          "store1-page"
        );
        expect(store1.get(confluenceAtom).publishStatus).toBe("uploaded");
      });
    });
  });
});
