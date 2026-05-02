/**
 * smartTemplateRoute.ts
 *
 * "Smart Templates" — generates precise DXF files from natural language descriptions.
 * Uses GPT-4o to parse the user's intent into structured parameters,
 * then generates a pixel-perfect SVG programmatically (no AI image generation).
 *
 * Supported templates:
 *   - playing_cards  : full 52-card deck or subset, flat top-view
 *   - chess_board    : 8×8 board with optional pieces
 *   - puzzle         : rectangular jigsaw puzzle grid
 *   - dice           : standard 6-face dice net
 *   - domino         : domino tile set
 *   - frame          : decorative rectangular frame
 *   - grid           : generic grid/tile layout
 *   - custom_shapes  : repeated shapes (circles, hexagons, stars, etc.)
 */

import express from "express";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { svgToDxf } from "./svgToDxf";
import { storagePut } from "./storage";
import { deductTokens } from "./tokenService";
import { recordUserAction } from "./userActionsDb";
import { getAppUserFromCookie } from "./appAuth";

export const smartTemplateRouter = express.Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateParams {
  type: "playing_cards" | "chess_board" | "puzzle" | "dice" | "domino" | "frame" | "grid" | "custom_shapes";
  // playing_cards
  suits?: ("hearts" | "diamonds" | "clubs" | "spades")[];
  cardWidthMm?: number;
  cardHeightMm?: number;
  cardsPerRow?: number;
  includeAllCards?: boolean;
  cardStyle?: "minimal" | "classic";
  // chess_board
  squareSizeMm?: number;
  includePieces?: boolean;
  // puzzle
  puzzleWidthMm?: number;
  puzzleHeightMm?: number;
  puzzleCols?: number;
  puzzleRows?: number;
  // dice
  diceSizeMm?: number;
  diceCount?: number;
  // domino
  dominoWidthMm?: number;
  dominoHeightMm?: number;
  // frame
  frameWidthMm?: number;
  frameHeightMm?: number;
  frameThicknessMm?: number;
  cornerStyle?: "square" | "round" | "decorative";
  // grid
  gridCols?: number;
  gridRows?: number;
  cellSizeMm?: number;
  // custom_shapes
  shapeType?: "circle" | "hexagon" | "star" | "triangle" | "square";
  shapeSizeMm?: number;
  shapeCols?: number;
  shapeRows?: number;
  shapeSpacingMm?: number;
  // general
  description?: string;
}

// ─── GPT Prompt Parser ────────────────────────────────────────────────────────

async function parseTemplateParams(userPrompt: string): Promise<TemplateParams> {
  const systemPrompt = `You are a CNC/laser engraving template parameter extractor.
Given a user description, extract structured parameters for generating a precise DXF template.

Return a JSON object with these fields:
- type: one of "playing_cards" | "chess_board" | "puzzle" | "dice" | "domino" | "frame" | "grid" | "custom_shapes"
- For playing_cards: suits (array of "hearts","diamonds","clubs","spades"), cardWidthMm (default 63), cardHeightMm (default 88), cardsPerRow (default 13), includeAllCards (default true), cardStyle ("minimal" or "classic", default "classic")
- For chess_board: squareSizeMm (default 50), includePieces (default false)
- For puzzle: puzzleWidthMm (default 200), puzzleHeightMm (default 150), puzzleCols (default 5), puzzleRows (default 4)
- For dice: diceSizeMm (default 40), diceCount (default 1)
- For domino: dominoWidthMm (default 25), dominoHeightMm (default 50)
- For frame: frameWidthMm (default 200), frameHeightMm (default 150), frameThicknessMm (default 10), cornerStyle ("square","round","decorative")
- For grid: gridCols (default 10), gridRows (default 10), cellSizeMm (default 20)
- For custom_shapes: shapeType ("circle","hexagon","star","triangle","square"), shapeSizeMm (default 30), shapeCols (default 5), shapeRows (default 4), shapeSpacingMm (default 5)
- description: short English description of what was requested

Examples:
"חבילת קלפים" → {"type":"playing_cards","suits":["hearts","diamonds","clubs","spades"],"cardWidthMm":63,"cardHeightMm":88,"cardsPerRow":13,"includeAllCards":true,"cardStyle":"classic","description":"Full 52-card playing card deck"}
"לוח שחמט 40 ס\"מ" → {"type":"chess_board","squareSizeMm":50,"includePieces":false,"description":"Chess board 40cm"}
"פאזל 20x15 ס\"מ 4x3" → {"type":"puzzle","puzzleWidthMm":200,"puzzleHeightMm":150,"puzzleCols":4,"puzzleRows":3,"description":"Puzzle 20x15cm 4x3"}
"קוביה" → {"type":"dice","diceSizeMm":40,"diceCount":1,"description":"Dice net"}
"מסגרת 20x15" → {"type":"frame","frameWidthMm":200,"frameHeightMm":150,"frameThicknessMm":10,"cornerStyle":"square","description":"Frame 20x15cm"}`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: systemPrompt as string },
      { role: "user" as const, content: userPrompt as string },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "template_params",
        strict: true,
        schema: {
          type: "object",
          properties: {
            type: { type: "string" },
            suits: { type: "array", items: { type: "string" } },
            cardWidthMm: { type: "number" },
            cardHeightMm: { type: "number" },
            cardsPerRow: { type: "number" },
            includeAllCards: { type: "boolean" },
            cardStyle: { type: "string" },
            squareSizeMm: { type: "number" },
            includePieces: { type: "boolean" },
            puzzleWidthMm: { type: "number" },
            puzzleHeightMm: { type: "number" },
            puzzleCols: { type: "number" },
            puzzleRows: { type: "number" },
            diceSizeMm: { type: "number" },
            diceCount: { type: "number" },
            dominoWidthMm: { type: "number" },
            dominoHeightMm: { type: "number" },
            frameWidthMm: { type: "number" },
            frameHeightMm: { type: "number" },
            frameThicknessMm: { type: "number" },
            cornerStyle: { type: "string" },
            gridCols: { type: "number" },
            gridRows: { type: "number" },
            cellSizeMm: { type: "number" },
            shapeType: { type: "string" },
            shapeSizeMm: { type: "number" },
            shapeCols: { type: "number" },
            shapeRows: { type: "number" },
            shapeSpacingMm: { type: "number" },
            description: { type: "string" },
          },
          required: ["type", "description"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content ?? "{}";
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  return JSON.parse(content) as TemplateParams;
}

// ─── SVG Generators ───────────────────────────────────────────────────────────

const MARGIN = 10; // mm margin around the design
const MM_TO_PX = 3.7795275591; // 1mm = 3.7795... px at 96dpi

function mm(v: number) { return v * MM_TO_PX; }

/** Generate SVG for a full playing card deck */
function generatePlayingCardsSvg(p: TemplateParams): string {
  const cw = mm(p.cardWidthMm ?? 63);
  const ch = mm(p.cardHeightMm ?? 88);
  const gap = mm(3);
  const cornerR = mm(3);
  const perRow = p.cardsPerRow ?? 13;
  const margin = mm(MARGIN);

  const suits = p.suits ?? ["spades", "hearts", "diamonds", "clubs"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const suitSymbols: Record<string, string> = {
    spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
  };

  const cards: { rank: string; suit: string }[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({ rank, suit });
    }
  }

  const cols = perRow;
  const rows = Math.ceil(cards.length / cols);
  const totalW = cols * (cw + gap) - gap + 2 * margin;
  const totalH = rows * (ch + gap) - gap + 2 * margin;

  let svgParts = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svgParts += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cw + gap);
    const y = margin + row * (ch + gap);
    const sym = suitSymbols[card.suit] ?? "?";
    const fontSize = mm(7);
    const symSize = mm(14);
    const centerSymSize = mm(20);

    // Card outline with rounded corners
    svgParts += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="${cornerR}" ry="${cornerR}" fill="white" stroke="black" stroke-width="1.5"/>`;

    // Top-left rank + suit
    svgParts += `<text x="${x + mm(3)}" y="${y + mm(8)}" font-family="serif" font-size="${fontSize}" font-weight="bold" fill="black" text-anchor="start">${card.rank}</text>`;
    svgParts += `<text x="${x + mm(3)}" y="${y + mm(15)}" font-family="serif" font-size="${fontSize}" fill="black" text-anchor="start">${sym}</text>`;

    // Bottom-right rank + suit (rotated 180°)
    svgParts += `<text x="${x + cw - mm(3)}" y="${y + ch - mm(8)}" font-family="serif" font-size="${fontSize}" font-weight="bold" fill="black" text-anchor="end" transform="rotate(180,${x + cw - mm(3)},${y + ch - mm(8)})">${card.rank}</text>`;
    svgParts += `<text x="${x + cw - mm(3)}" y="${y + ch - mm(15)}" font-family="serif" font-size="${fontSize}" fill="black" text-anchor="end" transform="rotate(180,${x + cw - mm(3)},${y + ch - mm(15)})">${sym}</text>`;

    // Center symbol
    svgParts += `<text x="${x + cw / 2}" y="${y + ch / 2 + centerSymSize * 0.35}" font-family="serif" font-size="${centerSymSize}" fill="black" text-anchor="middle">${sym}</text>`;
  });

  svgParts += `</svg>`;
  return svgParts;
}

/** Generate SVG for a chess board */
function generateChessBoardSvg(p: TemplateParams): string {
  const sq = mm(p.squareSizeMm ?? 50);
  const margin = mm(MARGIN);
  const boardSize = 8 * sq;
  const totalW = boardSize + 2 * margin;
  const totalH = boardSize + 2 * margin;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  // Board border
  svg += `<rect x="${margin}" y="${margin}" width="${boardSize}" height="${boardSize}" fill="white" stroke="black" stroke-width="2"/>`;

  // Squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isDark = (row + col) % 2 === 1;
      const x = margin + col * sq;
      const y = margin + row * sq;
      if (isDark) {
        svg += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="black" stroke="none"/>`;
      } else {
        svg += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="white" stroke="black" stroke-width="0.5"/>`;
      }
    }
  }

  // Coordinate labels
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const labelSize = mm(4);
  for (let i = 0; i < 8; i++) {
    // File labels (bottom)
    svg += `<text x="${margin + i * sq + sq / 2}" y="${margin + boardSize + mm(7)}" font-family="sans-serif" font-size="${labelSize}" fill="black" text-anchor="middle">${files[i]}</text>`;
    // Rank labels (left)
    svg += `<text x="${margin - mm(5)}" y="${margin + i * sq + sq / 2 + labelSize * 0.35}" font-family="sans-serif" font-size="${labelSize}" fill="black" text-anchor="middle">${ranks[i]}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for a jigsaw puzzle grid */
function generatePuzzleSvg(p: TemplateParams): string {
  const pw = mm(p.puzzleWidthMm ?? 200);
  const ph = mm(p.puzzleHeightMm ?? 150);
  const cols = p.puzzleCols ?? 5;
  const rows = p.puzzleRows ?? 4;
  const margin = mm(MARGIN);
  const totalW = pw + 2 * margin;
  const totalH = ph + 2 * margin;
  const cw = pw / cols;
  const ch = ph / rows;
  const tabSize = Math.min(cw, ch) * 0.2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  // Outer border
  svg += `<rect x="${margin}" y="${margin}" width="${pw}" height="${ph}" fill="white" stroke="black" stroke-width="2"/>`;

  // Internal horizontal lines with tab notches
  for (let row = 1; row < rows; row++) {
    const y = margin + row * ch;
    for (let col = 0; col < cols; col++) {
      const x1 = margin + col * cw;
      const x2 = margin + (col + 1) * cw;
      const mx = (x1 + x2) / 2;
      const tabDir = (row + col) % 2 === 0 ? -1 : 1;
      svg += `<path d="M${x1},${y} L${mx - tabSize},${y} Q${mx},${y + tabDir * tabSize * 1.5} ${mx + tabSize},${y} L${x2},${y}" fill="none" stroke="black" stroke-width="1.2"/>`;
    }
  }

  // Internal vertical lines with tab notches
  for (let col = 1; col < cols; col++) {
    const x = margin + col * cw;
    for (let row = 0; row < rows; row++) {
      const y1 = margin + row * ch;
      const y2 = margin + (row + 1) * ch;
      const my = (y1 + y2) / 2;
      const tabDir = (row + col) % 2 === 0 ? 1 : -1;
      svg += `<path d="M${x},${y1} L${x},${my - tabSize} Q${x + tabDir * tabSize * 1.5},${my} ${x},${my + tabSize} L${x},${y2}" fill="none" stroke="black" stroke-width="1.2"/>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for a dice net (cross layout) */
function generateDiceSvg(p: TemplateParams): string {
  const s = mm(p.diceSizeMm ?? 40);
  const margin = mm(MARGIN);
  const dotR = s * 0.07;
  const totalW = 4 * s + 2 * margin;
  const totalH = 3 * s + 2 * margin;

  // Standard dice net positions (cross): face 1 at (1,1), 2 at (0,1), 3 at (1,0), 4 at (1,2), 5 at (2,1), 6 at (3,1)
  const faces: { col: number; row: number; dots: [number, number][] }[] = [
    { col: 1, row: 1, dots: [[0.5, 0.5]] }, // 1
    { col: 0, row: 1, dots: [[0.25, 0.25], [0.75, 0.75]] }, // 2
    { col: 1, row: 0, dots: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]] }, // 3
    { col: 1, row: 2, dots: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] }, // 4
    { col: 2, row: 1, dots: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]] }, // 5
    { col: 3, row: 1, dots: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]] }, // 6
  ];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  for (const face of faces) {
    const fx = margin + face.col * s;
    const fy = margin + face.row * s;
    svg += `<rect x="${fx}" y="${fy}" width="${s}" height="${s}" fill="white" stroke="black" stroke-width="1.5"/>`;
    for (const [dx, dy] of face.dots) {
      svg += `<circle cx="${fx + dx * s}" cy="${fy + dy * s}" r="${dotR}" fill="black"/>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for a domino set */
function generateDominoSvg(p: TemplateParams): string {
  const dw = mm(p.dominoWidthMm ?? 25);
  const dh = mm(p.dominoHeightMm ?? 50);
  const gap = mm(3);
  const margin = mm(MARGIN);
  const dotR = dw * 0.1;

  // All domino tiles (0-0 to 6-6)
  const tiles: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }

  const perRow = 7;
  const rows = Math.ceil(tiles.length / perRow);
  const totalW = perRow * (dw + gap) - gap + 2 * margin;
  const totalH = rows * (dh + gap) - gap + 2 * margin;

  const dotPositions: Record<number, [number, number][]> = {
    0: [],
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  tiles.forEach(([a, b], i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = margin + col * (dw + gap);
    const y = margin + row * (dh + gap);
    const halfH = dh / 2;

    // Tile outline
    svg += `<rect x="${x}" y="${y}" width="${dw}" height="${dh}" rx="${dw * 0.1}" fill="white" stroke="black" stroke-width="1.5"/>`;
    // Divider line
    svg += `<line x1="${x + dw * 0.1}" y1="${y + halfH}" x2="${x + dw * 0.9}" y2="${y + halfH}" stroke="black" stroke-width="1"/>`;

    // Top half dots
    for (const [dx, dy] of dotPositions[a] ?? []) {
      svg += `<circle cx="${x + dx * dw}" cy="${y + dy * halfH}" r="${dotR}" fill="black"/>`;
    }
    // Bottom half dots
    for (const [dx, dy] of dotPositions[b] ?? []) {
      svg += `<circle cx="${x + dx * dw}" cy="${y + halfH + dy * halfH}" r="${dotR}" fill="black"/>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for a decorative frame */
function generateFrameSvg(p: TemplateParams): string {
  const fw = mm(p.frameWidthMm ?? 200);
  const fh = mm(p.frameHeightMm ?? 150);
  const thick = mm(p.frameThicknessMm ?? 10);
  const margin = mm(MARGIN);
  const cornerStyle = p.cornerStyle ?? "square";
  const totalW = fw + 2 * margin;
  const totalH = fh + 2 * margin;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  if (cornerStyle === "round") {
    const r = thick * 0.8;
    svg += `<rect x="${margin}" y="${margin}" width="${fw}" height="${fh}" rx="${r}" ry="${r}" fill="none" stroke="black" stroke-width="${thick}"/>`;
  } else if (cornerStyle === "decorative") {
    // Outer + inner border with corner ornaments
    svg += `<rect x="${margin}" y="${margin}" width="${fw}" height="${fh}" fill="none" stroke="black" stroke-width="2"/>`;
    svg += `<rect x="${margin + thick}" y="${margin + thick}" width="${fw - 2 * thick}" height="${fh - 2 * thick}" fill="none" stroke="black" stroke-width="1.5"/>`;
    // Corner ornaments
    const cs = thick * 0.8;
    const corners = [[margin, margin], [margin + fw, margin], [margin, margin + fh], [margin + fw, margin + fh]] as [number, number][];
    for (const [cx, cy] of corners) {
      svg += `<circle cx="${cx}" cy="${cy}" r="${cs * 0.5}" fill="black"/>`;
    }
  } else {
    // Square: outer - inner = frame
    svg += `<rect x="${margin}" y="${margin}" width="${fw}" height="${fh}" fill="none" stroke="black" stroke-width="${thick}"/>`;
    svg += `<rect x="${margin + thick / 2}" y="${margin + thick / 2}" width="${fw - thick}" height="${fh - thick}" fill="none" stroke="black" stroke-width="1"/>`;
  }

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for a generic grid */
function generateGridSvg(p: TemplateParams): string {
  const cols = p.gridCols ?? 10;
  const rows = p.gridRows ?? 10;
  const cs = mm(p.cellSizeMm ?? 20);
  const margin = mm(MARGIN);
  const totalW = cols * cs + 2 * margin;
  const totalH = rows * cs + 2 * margin;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  // Vertical lines
  for (let c = 0; c <= cols; c++) {
    const x = margin + c * cs;
    svg += `<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + rows * cs}" stroke="black" stroke-width="${c === 0 || c === cols ? 2 : 0.8}"/>`;
  }
  // Horizontal lines
  for (let r = 0; r <= rows; r++) {
    const y = margin + r * cs;
    svg += `<line x1="${margin}" y1="${y}" x2="${margin + cols * cs}" y2="${y}" stroke="black" stroke-width="${r === 0 || r === rows ? 2 : 0.8}"/>`;
  }

  svg += `</svg>`;
  return svg;
}

/** Generate SVG for custom repeated shapes */
function generateCustomShapesSvg(p: TemplateParams): string {
  const cols = p.shapeCols ?? 5;
  const rows = p.shapeRows ?? 4;
  const s = mm(p.shapeSizeMm ?? 30);
  const gap = mm(p.shapeSpacingMm ?? 5);
  const margin = mm(MARGIN);
  const shapeType = p.shapeType ?? "circle";
  const totalW = cols * (s + gap) - gap + 2 * margin;
  const totalH = rows * (s + gap) - gap + 2 * margin;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="white"/>`;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = margin + col * (s + gap) + s / 2;
      const cy = margin + row * (s + gap) + s / 2;
      const r = s / 2;

      if (shapeType === "circle") {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="black" stroke-width="1.5"/>`;
      } else if (shapeType === "square") {
        svg += `<rect x="${cx - r}" y="${cy - r}" width="${s}" height="${s}" fill="none" stroke="black" stroke-width="1.5"/>`;
      } else if (shapeType === "triangle") {
        const pts = `${cx},${cy - r} ${cx - r * 0.866},${cy + r * 0.5} ${cx + r * 0.866},${cy + r * 0.5}`;
        svg += `<polygon points="${pts}" fill="none" stroke="black" stroke-width="1.5"/>`;
      } else if (shapeType === "hexagon") {
        const pts = Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(" ");
        svg += `<polygon points="${pts}" fill="none" stroke="black" stroke-width="1.5"/>`;
      } else if (shapeType === "star") {
        const outerR = r;
        const innerR = r * 0.4;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const radius = i % 2 === 0 ? outerR : innerR;
          return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
        }).join(" ");
        svg += `<polygon points="${pts}" fill="none" stroke="black" stroke-width="1.5"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

/** Route all template types to their generators */
function generateTemplateSvg(params: TemplateParams): string {
  switch (params.type) {
    case "playing_cards": return generatePlayingCardsSvg(params);
    case "chess_board": return generateChessBoardSvg(params);
    case "puzzle": return generatePuzzleSvg(params);
    case "dice": return generateDiceSvg(params);
    case "domino": return generateDominoSvg(params);
    case "frame": return generateFrameSvg(params);
    case "grid": return generateGridSvg(params);
    case "custom_shapes": return generateCustomShapesSvg(params);
    default: return generateGridSvg(params);
  }
}

// ─── Express Route ────────────────────────────────────────────────────────────

smartTemplateRouter.post("/api/smart-template/generate", async (req, res) => {
  const startTime = Date.now();
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
  const appUser = getAppUserFromCookie(cookies);

  if (!appUser) {
    return res.status(401).json({ error: "LOGIN_REQUIRED", message: "נדרשת התחברות" });
  }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "EMPTY_PROMPT", message: "יש להזין תיאור" });
  }

  // Check tokens
  const tokenCheck = await deductTokens(appUser.userId, "smart_template", { checkOnly: true });
  if (!tokenCheck.success) {
    return res.status(402).json({ error: "INSUFFICIENT_TOKENS", message: "אין מספיק אסימונים", balance: tokenCheck.balance });
  }

  try {
    // Parse intent with GPT-4o
    const params = await parseTemplateParams(prompt.trim());

    // Generate SVG deterministically
    const rawSvg = generateTemplateSvg(params);

    // Convert SVG → DXF
    const { dxf, segmentCount, realWidth, realHeight } = svgToDxf(rawSvg);

    // Upload DXF to S3
    const dxfFilename = `smart-template-${params.type}-${nanoid(6)}.dxf`;
    const dxfKey = `dxf-smart/${nanoid()}-${dxfFilename}`;
    const { url: dxfUrl } = await storagePut(dxfKey, Buffer.from(dxf, "utf-8"), "application/dxf");

    // Upload SVG to S3
    const svgKey = `svg-smart/${nanoid()}-${dxfFilename.replace(".dxf", ".svg")}`;
    const { url: svgUrl } = await storagePut(svgKey, Buffer.from(rawSvg, "utf-8"), "image/svg+xml");

    // Deduct tokens
    await deductTokens(appUser.userId, "smart_template");

    // Save to history
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: params.description ?? prompt.slice(0, 200),
      segmentCount,
      dxfUrl,
      svgUrl,
      svgPreview: rawSvg,
      feature: "smart_template",
      durationMs: Date.now() - startTime,
    });

    return res.json({
      success: true,
      svgPreview: rawSvg,
      dxfUrl,
      svgUrl,
      segmentCount,
      realWidthMm: Math.round(realWidth / MM_TO_PX),
      realHeightMm: Math.round(realHeight / MM_TO_PX),
      templateType: params.type,
      description: params.description,
    });
  } catch (err) {
    console.error("[smartTemplateRoute] Error:", err);
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
    void recordUserAction({
      appUserId: appUser.userId,
      actionType: "ai_generate",
      description: "smart_template — נכשל",
      feature: "smart_template",
      durationMs: Date.now() - startTime,
      status: "failed",
      errorMessage: message.slice(0, 500),
    });
    return res.status(500).json({ error: "GENERATION_FAILED", message });
  }
});
