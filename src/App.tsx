import { useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import { QRCodeSVG } from 'qrcode.react'

function Smartphone({ hostId }: { hostId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const connRef = useRef<DataConnection | null>(null)
  const [message, setMessage] = useState('ドン！')

  useEffect(() => {
    let stream: MediaStream | null = null
    const peer = new Peer()

    function tryCall() {
      if (peer.open && stream) {
        peer.call(hostId, stream)

        const conn = peer.connect(hostId)
        conn.on('open', () => {
          connRef.current = conn
          conn.send('接続完了!')
        })
        conn.on('close', () => {
          if (connRef.current == conn) {
            connRef.current = null
          }
        })
      }
    }

    peer.on('open', () => {
      tryCall()
    })


    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })

        if (peer.destroyed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        tryCall()

      } catch (error) {
        console.error('カメラの取得に失敗しました', error)
      }
    }
    startCamera()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      connRef.current = null
      peer.destroy()
    }
  }, [hostId])

  return (
    <div
      onClick={() => {
        if (connRef.current && connRef.current.open) {
          connRef.current.send(message)
        }
      }}
      className="h-dvh overflow-hidden bg-blue-100 p-4"
    >
      <div className="flex flex-row items-center gap-4">
        <h1 className="mb-4 text-sm font-bold">
          スマホカメラ
        </h1>
        <p className="mb-4 break-all">
          接続先PC：{hostId}
        </p>
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mb-4 rounded border bg-white p-2"
        placeholder="送信する文字"
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded bg-black"
      />
    </div>
  )
}

function VideoPanel({
  stream,
  effects,
}: {
  stream: MediaStream
  effects: {
    id: number
    peerId: string
    text: string
    x: number
    y: number
  }[]
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch((err) => console.error('再生エラー:', err))
    }
  }, [stream])

  return (
    <div className="relative [container-type:inline-size]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded bg-black"
      />

      {effects.map((effect) => (
        <span
          key={effect.id}
          className="pointer-events-none absolute animate-[floatUp_1s_ease-out_forwards] text-xs font-black text-white"
          style={{
            left: `${effect.x}%`,
            bottom: `${effect.y}%`,
          }}
        >
          {effect.text}
        </span>
      ))}
    </div>
  )
}
function App() {

  const [peerId, setPeerId] = useState('')
  const [videos, setVideos] = useState<
    { peerId: string; stream: MediaStream }[]
  >([])
  const [effects, setEffects] = useState<
    { id: number; peerId: string; text: string; x: number; y: number }[]
  >([])

  const smartphoneUrl = `${window.location.origin}${import.meta.env.BASE_URL}?host=${peerId}`

  useEffect(() => {
    const peer = new Peer()

    peer.on('open', (id) => {
      setPeerId(id)
    })

    peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        setEffects((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            peerId: conn.peer,
            text: String(data),
            x: 30 + Math.random() * 40,
            y: 10 + Math.random() * 20,
          },
        ])
      })
    })

    peer.on('call', (call) => {
      call.answer()

      let streamId: string | null = null

      function removeVideo() {
        if (streamId) {
          setVideos((prev) =>
            prev.filter((video) => video.stream.id !== streamId)
          )
        }
      }

      call.on('stream', (stream) => {
        streamId = stream.id
        setVideos((prev) => [...prev, { peerId: call.peer, stream }])

        const connection = call.peerConnection
        connection.addEventListener('connectionstatechange', () => {
          console.log(connection.connectionState)
          if (
            connection.connectionState === 'failed' ||
            connection.connectionState === 'closed'
          ) {
            removeVideo()
          }
        })
      })

      call.on('close', removeVideo)
    })

    return () => {
      peer.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="mb-4 text-2xl font-bold">
        スマホ映像モニター
      </h1>

      <p>PCのPeer ID：<span className="mt-2 break-all rounded bg-white p-4">
        {peerId || '接続待機中...'}
      </span></p>
      {peerId && (
        <div className="flex flex-row items-center gap-4">
          <div className="mt-6 inline-block rounded bg-white p-4">
            <a
              href={smartphoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <QRCodeSVG
                value={smartphoneUrl}
                size={200}
              />
            </a>
          </div>
          <h2 className="mt-8 mb-4 text-xl font-bold">
            接続中のスマホ：{videos.length}台
          </h2>
        </div>
      )}

      <div className="grid grid-cols-6 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoPanel
            key={video.stream.id}
            stream={video.stream}
            effects={effects.filter((effect) => effect.peerId === video.peerId)}
          />
        ))}
      </div>
    </div>
  )
}

function Main() {
  const hostId = new URLSearchParams(window.location.search).get('host')
  return hostId ? <Smartphone hostId={hostId} /> : <App />
}

export default Main
