"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoTrack,
} from "livekit-client";
import { Avatar } from "./ui";
import { LiveMatch, Role } from "@/lib/api";

type Status = "connecting" | "connected" | "failed";
export type MediaGrant = { url: string; token: string } | null;

const SEATS: Role[] = ["player1", "referee", "player2"];

/**
 * Remote matches: everyone's camera and voice (a LiveKit room per match),
 * like the app's RemoteMediaPanel. The referee seat speaks and shows its
 * camera; a tile for each seat shows its video, or its avatar glowing while
 * it speaks; this browser's mic and camera can be switched off.
 */
export default function RemoteMedia({
  match,
  requestToken,
}: {
  match: LiveMatch & { you: string };
  requestToken: () => Promise<MediaGrant>;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [room, setRoom] = useState<Room | null>(null);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const audio = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const r = new Room({ adaptiveStream: true, dynacast: true });
    const playAudio = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      audio.current?.appendChild(el);
    };
    r.on(RoomEvent.TrackSubscribed, (track) => {
      playAudio(track);
      refresh();
    })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        refresh();
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!r.canPlaybackAudio));
    for (const e of [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ]) {
      r.on(e, refresh);
    }

    (async () => {
      setStatus("connecting");
      const grant = await requestToken();
      if (cancelled) return;
      if (!grant) return setStatus("failed");
      try {
        await r.connect(grant.url, grant.token);
      } catch {
        if (!cancelled) setStatus("failed");
        return;
      }
      if (cancelled) return void r.disconnect();
      setRoom(r);
      setStatus("connected");
      setAudioBlocked(!r.canPlaybackAudio);
      // No camera or a refused permission: voice still works without one.
      await toggle(r, "mic", true, setMic);
      await toggle(r, "camera", true, setCamera);
    })();

    return () => {
      cancelled = true;
      setRoom(null);
      void r.disconnect();
    };
  }, [requestToken, attempt]);

  /** The room participant sitting in [role] (identities are seat names). */
  const participant = useCallback(
    (role: Role): Participant | undefined => {
      if (!room) return undefined;
      if (room.localParticipant.identity === role) return room.localParticipant;
      return [...room.remoteParticipants.values()].find((p) => p.identity === role);
    },
    [room],
  );

  return (
    <div className="card media">
      <div ref={audio} hidden />
      {status !== "connected" ? (
        <div className="media-status">
          {status === "connecting" ? <span className="spinner" /> : <span className="bad-text">⦸</span>}
          <span className="grow muted">
            {status === "connecting" ? "جارٍ الاتصال بالصوت والصورة…" : "تعذر الاتصال بالصوت والصورة"}
          </span>
          {status === "failed" && (
            <button className="ghost" onClick={() => setAttempt((a) => a + 1)}>
              إعادة المحاولة
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="media-tiles">
            {SEATS.map((role) => (
              <Tile
                key={role}
                role={role}
                name={match.participants[role]?.name}
                participant={participant(role)}
                isMe={match.you === role}
              />
            ))}
          </div>
          <div className="media-controls">
            <button
              className={`media-toggle ${mic ? "" : "off"}`}
              title="الميكروفون"
              onClick={() => room && toggle(room, "mic", !mic, setMic)}
            >
              {mic ? "🎙" : "🔇"} الميكروفون
            </button>
            <button
              className={`media-toggle ${camera ? "" : "off"}`}
              title="الكاميرا"
              onClick={() => room && toggle(room, "camera", !camera, setCamera)}
            >
              {camera ? "📹" : "🚫"} الكاميرا
            </button>
            {audioBlocked && (
              <button className="media-toggle" onClick={() => room?.startAudio().then(() => setAudioBlocked(false))}>
                🔊 تشغيل الصوت
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Switches this browser's mic or camera; off if the device refuses. */
async function toggle(room: Room, kind: "mic" | "camera", on: boolean, set: (v: boolean) => void) {
  try {
    if (kind === "mic") await room.localParticipant.setMicrophoneEnabled(on);
    else await room.localParticipant.setCameraEnabled(on);
    set(on);
  } catch {
    set(false);
  }
}

function Tile({
  role,
  name,
  participant: p,
  isMe,
}: {
  role: Role;
  name?: string | null;
  participant?: Participant;
  isMe: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const pub = p?.getTrackPublication(Track.Source.Camera);
  const video = pub && !pub.isMuted ? (pub.track as VideoTrack | undefined) : undefined;
  const speaking = p?.isSpeaking ?? false;
  const micOn = p?.isMicrophoneEnabled ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!video || !el) return;
    video.attach(el);
    return () => void video.detach(el);
  }, [video]);

  return (
    <div className={`media-tile ${speaking ? "speaking" : ""}`} data-seat={role}>
      {video ? (
        <video ref={ref} autoPlay playsInline muted className={isMe ? "mirror" : ""} />
      ) : (
        <div className="media-avatar">
          <Avatar role={role} name={name} online={!!p} size={64} />
        </div>
      )}
      <div className="media-label">
        <span className={micOn ? "" : "bad-text"}>{micOn ? "🎙" : "🔇"}</span>
        <span className="grow">{p ? (name ?? "") : "لم ينضم بعد"}</span>
        {isMe && <span className="subtle">أنت</span>}
      </div>
    </div>
  );
}
