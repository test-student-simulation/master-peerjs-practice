import { useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { QRCodeSVG } from 'qrcode.react'

function Smartphone({ hostId }: { hostId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    const peer = new Peer()
    let cancelled = false
    let peerReady = false

    function tryCall() {
      if (peerReady && stream && !cancelled) {
        peer.call(hostId, stream)
      }
    }

    async function startCamera() {
      try {
        // PeerServerへの接続完了を待つ
        peer.on('open', () => {
          peerReady = true
          tryCall()
        })

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })

        if (cancelled) {
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
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      peer.destroy()
    }
  }, [hostId])

  return (
    <div className="h-dvh overflow-hidden bg-blue-100 p-4">
      <h1 className="mb-4 text-2xl font-bold">
        スマホカメラ
      </h1>

      <p className="mb-4 break-all">
        接続先PC：{hostId}
      </p>

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

function VideoPanel({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full rounded bg-black"
    />
  )
}
function App() {
  const [peerId, setPeerId] = useState('')
  const [videos, setVideos] = useState<MediaStream[]>([])

  useEffect(() => {
    const peer = new Peer()

    peer.on('open', (id) => {
      setPeerId(id)
    })

    peer.on('call', (call) => {
      call.answer()

      let streamId: string | null = null

      function removeVideo() {
        if (streamId) {
          setVideos((prev) =>
            prev.filter((stream) => stream.id !== streamId)
          )
        }
      }

      call.on('stream', (stream) => {
        streamId = stream.id
        setVideos((prev) => [...prev, stream])

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

      <p>PCのPeer ID：</p>
      <p className="mt-2 break-all rounded bg-white p-4">
        {peerId || '接続待機中...'}
      </p>
      {peerId && (
        <div className="mt-6 inline-block rounded bg-white p-4">
          <a
            href={`${window.location.origin}/?host=${peerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <QRCodeSVG
              value={`${window.location.origin}/?host=${peerId}`}
              size={200}
            />
          </a>
        </div>
      )}
      <h2 className="mt-8 mb-4 text-xl font-bold">
        接続中のスマホ：{videos.length}台
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((stream) => (
          <VideoPanel key={stream.id} stream={stream} />
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
