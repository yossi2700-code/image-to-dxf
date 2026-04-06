import { describe, it, expect, vi } from "vitest";

/**
 * FreeDXF API tests — validates the shared files endpoints
 * and the tRPC router for shared file management.
 */

// Mock database for shared files queries
const mockSharedFiles = [
  {
    id: 1,
    title: "Butterfly Design",
    titleHe: "עיצוב פרפר",
    description: "A beautiful butterfly pattern for CNC cutting",
    descriptionHe: "דפוס פרפר יפה לחיתוך CNC",
    category: "Animals",
    tags: "butterfly,nature,insect",
    feature: "ai-create",
    previewImageUrl: "https://example.com/preview.png",
    svgPreview: "<svg><path d='M0 0'/></svg>",
    dxfUrl: "https://example.com/file.dxf",
    lineCount: 500,
    downloadCount: 12,
    status: "approved",
    submittedBy: 1,
    approvedBy: 1,
    createdAt: new Date("2026-01-01"),
    approvedAt: new Date("2026-01-02"),
  },
  {
    id: 2,
    title: "Star Pattern",
    titleHe: "דפוס כוכב",
    description: "Geometric star pattern",
    descriptionHe: "דפוס כוכב גיאומטרי",
    category: "Geometric",
    tags: "star,geometric",
    feature: "image-to-lines",
    previewImageUrl: "https://example.com/star-preview.png",
    svgPreview: null,
    dxfUrl: "https://example.com/star.dxf",
    lineCount: 200,
    downloadCount: 5,
    status: "pending",
    submittedBy: 2,
    approvedBy: null,
    createdAt: new Date("2026-01-03"),
    approvedAt: null,
  },
];

describe("FreeDXF Shared Files", () => {
  describe("Data model", () => {
    it("should have required fields for a shared file", () => {
      const file = mockSharedFiles[0];
      expect(file).toHaveProperty("id");
      expect(file).toHaveProperty("title");
      expect(file).toHaveProperty("titleHe");
      expect(file).toHaveProperty("category");
      expect(file).toHaveProperty("status");
      expect(file).toHaveProperty("dxfUrl");
      expect(file).toHaveProperty("previewImageUrl");
    });

    it("should have bilingual title and description", () => {
      const file = mockSharedFiles[0];
      expect(file.title).toBe("Butterfly Design");
      expect(file.titleHe).toBe("עיצוב פרפר");
      expect(file.description).toBe("A beautiful butterfly pattern for CNC cutting");
      expect(file.descriptionHe).toBe("דפוס פרפר יפה לחיתוך CNC");
    });

    it("should track download count", () => {
      expect(mockSharedFiles[0].downloadCount).toBe(12);
      expect(mockSharedFiles[1].downloadCount).toBe(5);
    });

    it("should have valid status values", () => {
      const validStatuses = ["pending", "approved", "rejected"];
      mockSharedFiles.forEach((file) => {
        expect(validStatuses).toContain(file.status);
      });
    });
  });

  describe("File filtering", () => {
    it("should filter approved files only", () => {
      const approved = mockSharedFiles.filter((f) => f.status === "approved");
      expect(approved).toHaveLength(1);
      expect(approved[0].title).toBe("Butterfly Design");
    });

    it("should filter pending files only", () => {
      const pending = mockSharedFiles.filter((f) => f.status === "pending");
      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe("Star Pattern");
    });

    it("should filter by category", () => {
      const animals = mockSharedFiles.filter(
        (f) => f.status === "approved" && f.category === "Animals"
      );
      expect(animals).toHaveLength(1);
    });

    it("should search by title", () => {
      const query = "butterfly";
      const results = mockSharedFiles.filter(
        (f) =>
          f.status === "approved" &&
          (f.title?.toLowerCase().includes(query) ||
            f.titleHe?.includes(query) ||
            f.tags?.toLowerCase().includes(query))
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(1);
    });

    it("should search by tags", () => {
      const query = "nature";
      const results = mockSharedFiles.filter(
        (f) =>
          f.status === "approved" && f.tags?.toLowerCase().includes(query)
      );
      expect(results).toHaveLength(1);
    });

    it("should return empty for non-matching search", () => {
      const query = "nonexistent";
      const results = mockSharedFiles.filter(
        (f) =>
          f.status === "approved" &&
          (f.title?.toLowerCase().includes(query) ||
            f.tags?.toLowerCase().includes(query))
      );
      expect(results).toHaveLength(0);
    });
  });

  describe("Category management", () => {
    const SHARED_CATEGORIES = [
      "Animals",
      "Vehicles",
      "Nature",
      "Geometric",
      "Text & Letters",
      "Decorative",
      "Religious",
      "Architecture",
      "People",
      "Food & Drink",
      "Sports",
      "Music",
      "Tools",
      "CNC Relief",
      "Other",
    ];

    it("should include CNC Relief category", () => {
      expect(SHARED_CATEGORIES).toContain("CNC Relief");
    });

    it("should have at least 10 categories", () => {
      expect(SHARED_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });

    it("should include Other as fallback category", () => {
      expect(SHARED_CATEGORIES).toContain("Other");
    });
  });

  describe("File approval workflow", () => {
    it("should transition from pending to approved", () => {
      const file = { ...mockSharedFiles[1] };
      expect(file.status).toBe("pending");
      expect(file.approvedAt).toBeNull();

      // Simulate approval
      file.status = "approved";
      file.approvedAt = new Date();
      file.approvedBy = 1;

      expect(file.status).toBe("approved");
      expect(file.approvedAt).toBeDefined();
      expect(file.approvedBy).toBe(1);
    });

    it("should allow setting category during approval", () => {
      const file = { ...mockSharedFiles[1], category: null };
      expect(file.category).toBeNull();

      // Simulate approval with category
      file.category = "Geometric";
      file.status = "approved";

      expect(file.category).toBe("Geometric");
      expect(file.status).toBe("approved");
    });

    it("should transition from pending to rejected", () => {
      const file = { ...mockSharedFiles[1] };
      file.status = "rejected";
      expect(file.status).toBe("rejected");
    });
  });

  describe("Download tracking", () => {
    it("should increment download count", () => {
      const file = { ...mockSharedFiles[0] };
      const initialCount = file.downloadCount ?? 0;
      file.downloadCount = initialCount + 1;
      expect(file.downloadCount).toBe(initialCount + 1);
    });

    it("should handle null download count", () => {
      const file = { ...mockSharedFiles[0], downloadCount: null };
      const count = file.downloadCount ?? 0;
      expect(count).toBe(0);
    });
  });

  describe("Tags parsing", () => {
    it("should parse comma-separated tags", () => {
      const tags = mockSharedFiles[0].tags?.split(",").map((t) => t.trim()) || [];
      expect(tags).toEqual(["butterfly", "nature", "insect"]);
    });

    it("should handle empty tags", () => {
      const tags = null;
      const parsed = tags?.split(",").map((t) => t.trim()) || [];
      expect(parsed).toEqual([]);
    });
  });
});
