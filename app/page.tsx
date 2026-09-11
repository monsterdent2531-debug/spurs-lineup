"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import { toBlob } from "html-to-image";
import html2canvas from "html2canvas-pro";

import { players } from "../data/players";
import { formations } from "../data/formations";
import { teams } from "../data/teams";

type PlayerPosition = {
  left: number;
  top: number;
};

type DragInfo = {
  offsetX: number;
  offsetY: number;
  widthPercent: number;
  heightPercent: number;
};

export default function Home() {
  // =====================================================
  // HOME / AWAY
  // =====================================================

  const [selectedHomeTeam, setSelectedHomeTeam] =
    useState("tottenham");

  const [selectedAwayTeam, setSelectedAwayTeam] =
    useState("forest");

  const homeTeam =
    teams.find(
      (team) => team.id === selectedHomeTeam
    ) ?? teams[0];

  const awayTeam =
    teams.find(
      (team) => team.id === selectedAwayTeam
    ) ?? teams[0];

  // =====================================================
  // FORMATION
  // =====================================================

  const [selectedFormation, setSelectedFormation] =
    useState<keyof typeof formations>(
      "4-2-3-1"
    );

  const currentPositions =
    formations[selectedFormation];

  // =====================================================
  // CUSTOM PLAYER POSITIONS
  // =====================================================

  const [customPositions, setCustomPositions] =
    useState<Record<string, PlayerPosition>>(
      {}
    );

  useEffect(() => {
    const positions: Record<
      string,
      PlayerPosition
    > = {};

    formations[selectedFormation].forEach(
      (position) => {
        positions[position.id] = {
          left: position.left,
          top: position.top,
        };
      }
    );

    setCustomPositions(positions);
  }, [selectedFormation]);

  // =====================================================
  // STARTING XI
  // =====================================================

  const [lineup, setLineup] =
    useState<
      Record<string, string | null>
    >({
      GK: "kinsky",
    });

  const [
    activePosition,
    setActivePosition,
  ] = useState<string | null>(null);

  // =====================================================
  // SUBS
  // =====================================================

  const [selectedSubs, setSelectedSubs] =
    useState<string[]>([]);

  const [
    subPickerOpen,
    setSubPickerOpen,
  ] = useState(false);

  // =====================================================
  // MOVE MODE
  // =====================================================

  const [moveMode, setMoveMode] =
    useState(false);

  const [
    draggingPosition,
    setDraggingPosition,
  ] = useState<string | null>(null);

  const graphicRef =
    useRef<HTMLDivElement>(null);

  const dragInfo =
    useRef<DragInfo>({
      offsetX: 0,
      offsetY: 0,
      widthPercent: 0,
      heightPercent: 0,
    });

  // =====================================================
  // EXPORT
  // =====================================================

  const [isExporting, setIsExporting] =
    useState(false);

const downloadPng = async () => {
  const node = graphicRef.current;

  if (!node || isExporting) {
    return;
  }

  try {
    setIsExporting(true);

    // รอ Font โหลดให้ครบ
    if (document.fonts) {
      await document.fonts.ready;
    }

    // รอรูปทั้งหมดโหลดให้ครบ
    const images = Array.from(
      node.querySelectorAll("img")
    );

    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );

    // รอ browser วาดหน้าให้เสร็จ
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    // สร้าง PNG เป็น Blob โดยตรง
    // ไม่ขยาย DOM จริงบนหน้าจอ
    const rect = node.getBoundingClientRect();

if (rect.width <= 0 || rect.height <= 0) {
  throw new Error("Graphic size is invalid");
}

// ขยายจากขนาดที่เห็นบนหน้าจอ
// ไปเป็นไฟล์กว้าง 2338px
const exportScale = 2338 / rect.width;

const exportOptions = {
  pixelRatio: exportScale,
  cacheBust: false,
  backgroundColor: "#000000",

  // ป้องกัน mx-auto ทำให้ภาพเลื่อนไปด้านข้าง
  style: {
    margin: "0",
  },

  filter: (element: HTMLElement) => {
    if (
      element instanceof HTMLElement &&
      element.dataset.exportIgnore === "true"
    ) {
      return false;
    }

    return true;
  },
};

// Safari / iPhone ให้ render รอบเบา ๆ ก่อน
const appleMobile =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1
  );

let blob: Blob | null = null;

if (appleMobile) {
  // iPhone / iPad ใช้ html2canvas
  const rect = node.getBoundingClientRect();
  const exportScale = 2338 / rect.width;

  const canvas = await html2canvas(node, {
    backgroundColor: "#000000",
    scale: exportScale,
    useCORS: true,
    allowTaint: false,
    logging: false,
  });

  blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      "image/png",
      1
    );
  });

} else {
  // PC ใช้ toBlob เหมือนเดิม
  blob = await toBlob(node, exportOptions);
}

    if (!blob) {
      throw new Error("PNG Blob was not created");
    }

    const filename =
      `${homeTeam.id}-vs-${awayTeam.id}-lineup.png`;

    const file = new File(
      [blob],
      filename,
      {
        type: "image/png",
      }
    );

    const isIOS =
      /iPad|iPhone|iPod/.test(
        navigator.userAgent
      ) ||
      (
        navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1
      );

    // iPhone / iPad
    if (
      isIOS &&
      navigator.share &&
      navigator.canShare?.({
        files: [file],
      })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });

        return;
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }

        console.warn(
          "Share failed:",
          shareError
        );
      }
    }

    // PC / Browser อื่น
    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error(
      "Export error:",
      error
    );

    alert(
  "ไม่สามารถสร้างไฟล์ PNG ได้\n\n" +
  String(error)
);

  } finally {
    setIsExporting(false);
  }
};


  // =====================================================
  // POSITION COMPATIBILITY
  // =====================================================

  const slotCompatibility: Record<
    string,
    string[]
  > = {
    GK: ["GK"],

    LB: [
      "LB",
      "LWB",
    ],

    LCB: [
      "LCB",
      "CB",
    ],

    RCB: [
      "RCB",
      "CB",
    ],

    RB: [
      "RB",
      "RWB",
    ],

    LCM: [
      "LCM",
      "CM",
      "DM",
    ],

    CM: [
      "CM",
      "DM",
      "CAM",
    ],

    RCM: [
      "RCM",
      "CM",
      "DM",
    ],

    CAM: [
      "CAM",
      "CM",
      "AM",
    ],

    LW: [
      "LW",
      "LM",
    ],

    RW: [
      "RW",
      "RM",
    ],

    ST: [
      "ST",
      "CF",
    ],
  };

  // =====================================================
  // STARTING XI PLAYER IDS
  // =====================================================

  const selectedPlayerIds =
    currentPositions
      .map(
        (position) =>
          lineup[position.id]
      )
      .filter(
        (id): id is string =>
          Boolean(id)
      );

  // =====================================================
  // AVAILABLE STARTERS
  // =====================================================

  const availablePlayers =
    activePosition
      ? players.filter(
          (player) => {
            const accepted =
              slotCompatibility[
                activePosition
              ] ?? [
                activePosition,
              ];

            const canPlay =
              player.positions.some(
                (position) =>
                  accepted.includes(
                    position
                  )
              );

            const alreadySelected =
              selectedPlayerIds.includes(
                player.id
              );

            const currentlyHere =
              lineup[
                activePosition
              ] === player.id;

            return (
              canPlay &&
              (!alreadySelected ||
                currentlyHere)
            );
          }
        )
      : [];

  const activePositionData =
    currentPositions.find(
      (position) =>
        position.id ===
        activePosition
    );

  // =====================================================
  // CHOOSE STARTER
  // =====================================================

  const choosePlayer = (
    playerId: string
  ) => {
    if (!activePosition) {
      return;
    }

    setLineup(
      (previous) => ({
        ...previous,

        [activePosition]:
          playerId,
      })
    );

    // ถ้าเคยเป็นตัวสำรอง
    // เอาออกจากตัวสำรอง
    setSelectedSubs(
      (previous) =>
        previous.filter(
          (id) =>
            id !== playerId
        )
    );

    setActivePosition(null);
  };

  // =====================================================
  // REMOVE STARTER
  // =====================================================

  const removePlayer = () => {
    if (!activePosition) {
      return;
    }

    setLineup(
      (previous) => ({
        ...previous,

        [activePosition]:
          null,
      })
    );

    setActivePosition(null);
  };

  // =====================================================
  // AVAILABLE SUBS
  // =====================================================

  const availableSubPlayers =
    players.filter(
      (player) =>
        !selectedPlayerIds.includes(
          player.id
        )
    );

  // =====================================================
  // TOGGLE SUB
  // =====================================================

  const toggleSub = (
    playerId: string
  ) => {
    if (
      selectedSubs.includes(
        playerId
      )
    ) {
      setSelectedSubs(
        (previous) =>
          previous.filter(
            (id) =>
              id !== playerId
          )
      );

      return;
    }

    if (
      selectedSubs.length >= 9
    ) {
      return;
    }

    setSelectedSubs(
      (previous) => [
        ...previous,
        playerId,
      ]
    );
  };

  // =====================================================
  // RESET POSITIONS
  // =====================================================

  const resetPositions = () => {
    const positions: Record<
      string,
      PlayerPosition
    > = {};

    currentPositions.forEach(
      (position) => {
        positions[position.id] = {
          left: position.left,
          top: position.top,
        };
      }
    );

    setCustomPositions(
      positions
    );
  };

  // =====================================================
  // DRAG START
  // =====================================================

  const handlePointerDown = (
    positionId: string,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!moveMode) return;

    const graphic =
      graphicRef.current;

    if (!graphic) return;

    event.preventDefault();

    const graphicRect =
      graphic.getBoundingClientRect();

    const playerRect =
      event.currentTarget.getBoundingClientRect();

    dragInfo.current = {
      offsetX:
        event.clientX -
        playerRect.left,

      offsetY:
        event.clientY -
        playerRect.top,

      widthPercent:
        (playerRect.width /
          graphicRect.width) *
        100,

      heightPercent:
        (playerRect.height /
          graphicRect.height) *
        100,
    };

    setDraggingPosition(
      positionId
    );

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  };

  // =====================================================
  // DRAG MOVE
  // =====================================================

  const handlePointerMove = (
    positionId: string,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!moveMode) return;

    if (
      draggingPosition !==
      positionId
    ) {
      return;
    }

    const graphic =
      graphicRef.current;

    if (!graphic) return;

    const rect =
      graphic.getBoundingClientRect();

    const info =
      dragInfo.current;

    let left =
      ((event.clientX -
        rect.left -
        info.offsetX) /
        rect.width) *
      100;

    let top =
      ((event.clientY -
        rect.top -
        info.offsetY) /
        rect.height) *
      100;

    left = Math.max(
      0,
      Math.min(
        left,
        100 -
          info.widthPercent
      )
    );

    top = Math.max(
      0,
      Math.min(
        top,
        100 -
          info.heightPercent
      )
    );

    setCustomPositions(
      (previous) => ({
        ...previous,

        [positionId]: {
          left,
          top,
        },
      })
    );
  };

  // =====================================================
  // DRAG END
  // =====================================================

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!moveMode) return;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    } catch {
      // ignore
    }

    setDraggingPosition(null);
  };

  return (
    <main className="min-h-screen bg-black p-4">

      {/* =================================================
          CONTROL PANEL
      ================================================= */}

      <div className="mx-auto mb-4 max-w-[800px] text-white">

        <div className="flex flex-wrap items-center gap-3">

          {/* HOME */}

          <span className="font-semibold">
            Home
          </span>

          <select
            value={
              selectedHomeTeam
            }

            onChange={(e) =>
              setSelectedHomeTeam(
                e.target.value
              )
            }

            className="rounded-lg bg-white px-4 py-2 text-black"
          >

            {teams
              .filter(
                (team) =>
                  team.id !==
                  selectedAwayTeam
              )
              .map((team) => (

                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>

              ))}

          </select>


          {/* AWAY */}

          <span className="font-semibold">
            Away
          </span>

          <select
            value={
              selectedAwayTeam
            }

            onChange={(e) =>
              setSelectedAwayTeam(
                e.target.value
              )
            }

            className="rounded-lg bg-white px-4 py-2 text-black"
          >

            {teams
              .filter(
                (team) =>
                  team.id !==
                  selectedHomeTeam
              )
              .map((team) => (

                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name}
                </option>

              ))}

          </select>


          {/* FORMATION */}

          <span className="font-semibold">
            Formation
          </span>

          <select
            value={
              selectedFormation
            }

            onChange={(e) =>
              setSelectedFormation(
                e.target
                  .value as keyof typeof formations
              )
            }

            className="rounded-lg bg-white px-4 py-2 text-black"
          >

            {Object.keys(
              formations
            ).map(
              (formation) => (

                <option
                  key={formation}
                  value={formation}
                >
                  {formation}
                </option>

              )
            )}

          </select>


          {/* CHOOSE SUBS */}

          <button
            type="button"

            onClick={() =>
              setSubPickerOpen(
                true
              )
            }

            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
          >
            Choose subs (
            {selectedSubs.length}/9)
          </button>


          {/* MOVE MODE */}

          <button
            type="button"

            onClick={() =>
              setMoveMode(
                (previous) =>
                  !previous
              )
            }

            className={
              moveMode
                ? "rounded-lg bg-green-600 px-4 py-2 font-semibold text-white"
                : "rounded-lg bg-gray-700 px-4 py-2 font-semibold text-white hover:bg-gray-600"
            }
          >
            {moveMode
              ? "✓ Move Players"
              : "Move Players"}
          </button>


          {/* RESET */}

          <button
            type="button"

            onClick={
              resetPositions
            }

            className="rounded-lg border border-white/40 px-4 py-2 font-semibold text-white hover:bg-white/10"
          >
            Reset Positions
          </button>


          {/* DOWNLOAD */}

          <button
            type="button"

            onClick={
              downloadPng
            }

            disabled={
              isExporting
            }

            className="
              rounded-lg
              bg-yellow-400
              px-4
              py-2
              font-bold
              text-black
              hover:bg-yellow-300
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            {isExporting
              ? "Creating PNG..."
              : "Download PNG"}
          </button>

        </div>


        {moveMode && (

          <div className="mt-3 rounded-lg bg-green-950/60 px-4 py-2 text-sm text-green-200">
            Move mode is ON — drag players with your mouse or finger.
          </div>

        )}

      </div>

      {/* =================================================
          GRAPHIC
      ================================================= */}

      <div
        ref={graphicRef}

        className="
          relative
          mx-auto
          w-full
          max-w-[800px]
          overflow-hidden
        "

        style={{
          aspectRatio:
            "2338 / 2921",
        }}
      >

        {/* PITCH */}

        <img
          src="/images/pitch/pitch.png"

          alt="Starting XI"

          className="
            absolute
            inset-0
            z-0
            h-full
            w-full
            select-none
          "

          draggable={false}
        />


        {/* HOME LOGO */}

        <img
          src={homeTeam.logo}

          alt={homeTeam.name}

          className="
            absolute
            z-10
            select-none
            object-contain
          "

          style={{
            width: "9.4%",
            left: "5%",
            top: "6%",
          }}

          draggable={false}
        />


        {/* AWAY LOGO */}

        <img
          src={awayTeam.logo}

          alt={awayTeam.name}

          className="
            absolute
            z-10
            select-none
            object-contain
          "

          style={{
            width: "9.4%",
            left: "19%",
            top: "6%",
          }}

          draggable={false}
        />


        {/* =================================================
            STARTING XI
        ================================================= */}

        {currentPositions.map(
          (position) => {

            const playerId =
              lineup[
                position.id
              ];

            const player =
              players.find(
                (item) =>
                  item.id ===
                  playerId
              );

            const customPosition =
              customPositions[
                position.id
              ] ?? {
                left:
                  position.left,

                top:
                  position.top,
              };


            // =============================================
            // PLAYER EXISTS
            // =============================================

            if (player) {

              return (

                <button
                  key={
                    position.id
                  }

                  type="button"

                  onClick={() => {

                    if (!moveMode) {

                      setActivePosition(
                        position.id
                      );

                    }

                  }}

                  onPointerDown={(
                    event
                  ) =>
                    handlePointerDown(
                      position.id,
                      event
                    )
                  }

                  onPointerMove={(
                    event
                  ) =>
                    handlePointerMove(
                      position.id,
                      event
                    )
                  }

                  onPointerUp={
                    handlePointerUp
                  }

                  onPointerCancel={
                    handlePointerUp
                  }

                  className={
                    moveMode
                      ? "absolute z-20 cursor-grab border-0 bg-transparent p-0 active:cursor-grabbing"
                      : "absolute z-20 cursor-pointer border-0 bg-transparent p-0"
                  }

                  style={{
                    width:
                      "15.83%",

                    left: `${customPosition.left}%`,

                    top: `${customPosition.top}%`,

                    touchAction:
                      moveMode
                        ? "none"
                        : "auto",
                  }}
                >

                  <img
                    src={
                      player.starterImage
                    }

                    alt={
                      player.name
                    }

                    className="
                      pointer-events-none
                      block
                      h-auto
                      w-full
                      select-none
                    "

                    draggable={
                      false
                    }
                  />

                </button>

              );

            }


            // =============================================
            // EMPTY POSITION
            // ไม่ Export กรอบนี้
            // =============================================

            return (

              <button
                key={
                  position.id
                }

                data-export-ignore="true"

                type="button"

                onClick={() => {

                  if (!moveMode) {

                    setActivePosition(
                      position.id
                    );

                  }

                }}

                className={
                  moveMode
                    ? "absolute z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-black/10 text-white/30"
                    : "absolute z-20 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-white/60 bg-black/20 text-white hover:bg-white/10"
                }

                style={{
                  width:
                    "15.83%",

                  aspectRatio:
                    "370 / 430",

                  left: `${customPosition.left}%`,

                  top: `${customPosition.top}%`,
                }}
              >

                <span className="text-sm font-bold">
                  {position.id}
                </span>

              </button>

            );

          }
        )}


        {/* =================================================
            SUBS
        ================================================= */}

        {selectedSubs.map(
          (
            playerId,
            index
          ) => {

            const player =
              players.find(
                (item) =>
                  item.id ===
                  playerId
              );

            if (!player) {
              return null;
            }

            const left =
              2.7 +
              index *
                10.5;

            return (

              <button
                key={
                  player.id
                }

                type="button"

                onClick={() => {

                  if (!moveMode) {

                    setSubPickerOpen(
                      true
                    );

                  }

                }}

                className="
                  absolute
                  z-30
                  border-0
                  bg-transparent
                  p-0
                "

                style={{
                  width:
                    "10.22%",

                  left: `${left}%`,

                  top:
                    "88.5%",
                }}
              >

                <img
                  src={
                    player.subImage
                  }

                  alt={
                    player.name
                  }

                  className="
                    block
                    h-auto
                    w-full
                    select-none
                  "

                  draggable={
                    false
                  }
                />

              </button>

            );

          }
        )}

      </div>

      {/* =================================================
          STARTING XI PICKER
      ================================================= */}

      {activePosition && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">

          <div className="w-full max-w-[500px] overflow-hidden rounded-2xl bg-[#0b1030] text-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-white/10 p-5">

              <div>

                <h2 className="text-xl font-bold">
                  Choose player
                </h2>

                <p className="mt-1 text-sm text-gray-400">

                  {
                    activePositionData?.label
                  }

                  {" · "}

                  {
                    activePosition
                  }

                </p>

              </div>


              <button
                type="button"

                onClick={() =>
                  setActivePosition(
                    null
                  )
                }

                className="text-3xl leading-none text-gray-400 hover:text-white"
              >
                ×
              </button>

            </div>


            {/* PLAYER LIST */}

            <div className="max-h-[65vh] overflow-y-auto">

              {availablePlayers.length === 0 && (

                <div className="p-8 text-center text-gray-400">
                  No players available
                </div>

              )}


              {availablePlayers.map(
                (player) => (

                  <button
                    key={
                      player.id
                    }

                    type="button"

                    onClick={() =>
                      choosePlayer(
                        player.id
                      )
                    }

                    className="flex w-full items-center gap-4 border-b border-white/10 p-4 text-left hover:bg-white/10"
                  >

                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5">

                      <img
                        src={
                          player.subImage
                        }

                        alt={
                          player.name
                        }

                        className="h-full w-full object-contain"

                        draggable={
                          false
                        }
                      />

                    </div>


                    <div>

                      <div className="text-lg font-semibold">
                        {
                          player.name
                        }
                      </div>


                      <div className="mt-1 text-sm text-gray-400">

                        {player.positions.join(
                          " / "
                        )}

                        {" · "}

                        {
                          player.number
                        }

                      </div>

                    </div>

                  </button>

                )
              )}

            </div>


            {/* REMOVE */}

            {lineup[
              activePosition
            ] && (

              <div className="border-t border-white/10 p-4">

                <button
                  type="button"

                  onClick={
                    removePlayer
                  }

                  className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
                >
                  Remove player
                </button>

              </div>

            )}

          </div>

        </div>

      )}

      {/* =================================================
          SUB PICKER
      ================================================= */}

      {subPickerOpen && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">

          <div className="flex max-h-[85vh] w-full max-w-[550px] flex-col overflow-hidden rounded-2xl bg-[#0b1030] text-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-white/10 p-5">

              <h2 className="text-xl font-bold">
                Choose your subs
              </h2>


              <button
                type="button"

                onClick={() =>
                  setSubPickerOpen(
                    false
                  )
                }

                className="text-3xl leading-none text-gray-400 hover:text-white"
              >
                ×
              </button>

            </div>


            {/* PLAYER LIST */}

            <div className="flex-1 overflow-y-auto">

              {availableSubPlayers.map(
                (player) => {

                  const selected =
                    selectedSubs.includes(
                      player.id
                    );

                  const disabled =
                    selectedSubs.length >=
                      9 &&
                    !selected;


                  return (

                    <button
                      key={
                        player.id
                      }

                      type="button"

                      disabled={
                        disabled
                      }

                      onClick={() =>
                        toggleSub(
                          player.id
                        )
                      }

                      className={`
                        flex
                        w-full
                        items-center
                        gap-4
                        border-b
                        border-white/10
                        p-4
                        text-left

                        ${
                          disabled
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-white/10"
                        }
                      `}
                    >

                      {/* CHECKBOX */}

                      <div
                        className={`
                          flex
                          h-7
                          w-7
                          flex-shrink-0
                          items-center
                          justify-center
                          rounded-md
                          border-2

                          ${
                            selected
                              ? "border-blue-400 bg-blue-500"
                              : "border-gray-500"
                          }
                        `}
                      >

                        {selected && (

                          <span className="font-bold">
                            ✓
                          </span>

                        )}

                      </div>


                      {/* IMAGE */}

                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5">

                        <img
                          src={
                            player.subImage
                          }

                          alt={
                            player.name
                          }

                          className="h-full w-full object-contain"

                          draggable={
                            false
                          }
                        />

                      </div>


                      {/* INFO */}

                      <div>

                        <div className="text-lg font-semibold">
                          {
                            player.name
                          }
                        </div>


                        <div className="text-sm text-gray-400">

                          {player.positions.join(
                            " / "
                          )}

                          {" · "}

                          {
                            player.number
                          }

                        </div>

                      </div>

                    </button>

                  );

                }
              )}

            </div>


            {/* FOOTER */}

            <div className="flex items-center justify-end gap-5 border-t border-white/10 p-4">

              <span className="text-sm text-gray-400">

                {
                  selectedSubs.length
                }{" "}
                of 9 picked

              </span>


              <button
                type="button"

                onClick={() =>
                  setSubPickerOpen(
                    false
                  )
                }

                className="rounded-full border border-yellow-400 px-5 py-2 font-bold text-yellow-300 hover:bg-yellow-400 hover:text-black"
              >
                DONE
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}