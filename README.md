# master-peerjs-practice 作業記録

## 1. 実習の目的

Vite + React + TypeScriptで、**スマートフォンのカメラ映像をPCにリアルタイム送信し、さらにスマートフォンから文字を送ってPCの映像上に表示するアプリ**を作成する。

PCに表示されたQRコードをスマートフォンで読み取り、PeerJSを使って接続する。

複数のスマートフォンからの映像をPC上に同時表示し、各スマートフォンの画面をタップすると、そのスマートフォンの映像上に「ドン！」などの文字が現れ、上昇しながら消える。

授業では、学生が自分のスマートフォンを使い、映像通信とデータ通信の違いを体験的に理解することを目指す。

### 使用技術

- Vite
- React / TypeScript
- Tailwind CSS v4
- PeerJS
- WebRTC
- qrcode.react
- GitHub Pages / GitHub Actions

## 2. Viteプロジェクトの準備

GitHubリポジトリ名：

`master-peerjs-practice`

リポジトリをクローンし、ViteでReact + TypeScriptプロジェクトを作成。

```bash
npm create vite@latest .
npm install
```

Tailwind CSS v4を導入。

```bash
npm install tailwindcss @tailwindcss/vite
```

`vite.config.ts`にTailwindのプラグインを追加した。

`src/index.css`ではTailwindを読み込む。

```css
@import "tailwindcss";
```

**注意点：** CSSにアニメーションを追加する際、既存の`@import "tailwindcss";`を消してしまうと、Tailwindのスタイルが適用されなくなる。

実際にこの問題が発生し、映像サイズや文字表示が崩れたが、`@import`を復元して解決した。

## 3. PeerJSの導入

```bash
npm install peerjs
```

PeerJSは、WebRTCを使ったブラウザ間通信を簡単に実装するためのライブラリ。

### 基本的な仕組み

```text
PC（受信側）
    │
    │ Peer IDを取得
    ↓
PeerServer（接続の仲介）
    ↑
    │ Peer IDを指定
    │
スマートフォン（送信側）

接続確立後：

スマートフォン ── 映像 ──→ PC
スマートフォン ── 文字 ──→ PC
                 WebRTC
```

PeerServerは、接続相手を見つけるためのシグナリングを担当する。

映像や文字は、接続確立後、WebRTCによって端末間で送受信される。ネットワーク環境によっては中継サーバーが必要になる場合もある。

### MediaConnectionとDataConnection

PeerJSでは、映像通信とデータ通信に異なる接続を使用する。

| 接続 | 主な用途 | 接続開始 |
|---|---|---|
| MediaConnection | 映像・音声 | `peer.call()` |
| DataConnection | 文字などのデータ | `peer.connect()` |

1つのPeerインスタンスで両方の接続を利用できる。

## 4. PC側の実装

PC側でPeerJSのインスタンスを生成する。

```ts
const peer = new Peer()
```

PeerServerとの接続が完了すると、`open`イベントでPeer IDを取得できる。

```ts
peer.on('open', (id) => {
  setPeerId(id)
})
```

### PC側の主な処理

1. PeerJSでPeer IDを取得する
2. Peer IDを含むQRコードを表示する
3. スマートフォンからの映像接続を受け付ける
4. 受信した映像を個別のパネルに表示する
5. スマートフォンからのデータ接続を受け付ける
6. 受信した文字を送信元の映像に重ねて表示する
7. 映像接続が切れたら該当するパネルを削除する

## 5. QRコードによる接続

QRコード生成ライブラリを導入。

```bash
npm install qrcode.react
```

PCのPeer IDをURLのクエリパラメータに埋め込む。

```ts
const smartphoneUrl =
  `${window.location.origin}${import.meta.env.BASE_URL}?host=${peerId}`
```

QRコードには`QRCodeSVG`を使用する。

### 学習上のポイント

- `window.location.origin`：現在のサイトのオリジン
- `import.meta.env.BASE_URL`：Viteで設定した公開先のベースパス
- `?host=...`：接続先Peer IDをURLに渡す
- `URLSearchParams`：URLから接続先Peer IDを取得する

アプリの起動時には、URLの`host`パラメータによってPC側とスマートフォン側を切り替える。

```tsx
function Main() {
  const hostId = new URLSearchParams(window.location.search).get('host')
  return hostId ? <Smartphone hostId={hostId} /> : <App />
}
```

## 6. スマートフォン側の映像送信

スマートフォンでQRコードを読み取り、URLにアクセスする。

カメラ映像を取得し、PeerJSを使ってPCへ送信する。

```ts
stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' },
  audio: false,
})
```

取得した`MediaStream`を、次のように送信する。

```ts
peer.call(hostId, stream)
```

### 接続開始のタイミング

映像送信には、次の2つの準備が必要となる。

- PeerServerへの接続が完了していること
- カメラ映像を取得できていること

どちらが先に完了するかは決まっていない。

そこで、両方の処理が完了したタイミングで`tryCall()`を実行する。

```ts
function tryCall() {
  if (peer.open && stream) {
    peer.call(hostId, stream)

    // DataConnectionの開始処理
  }
}
```

`peer.open`はPeerJSの内部状態を表すプロパティであり、独自の`peerReady`変数は不要になった。

### 非同期処理中の終了への対応

カメラ取得を待っている間にコンポーネントが終了する場合がある。

そのため、`getUserMedia()`の後で`peer.destroyed`を確認する。

```ts
if (peer.destroyed) {
  stream.getTracks().forEach((track) => track.stop())
  return
}
```

コンポーネント終了時には、カメラを停止し、Peerを破棄する。

```ts
return () => {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  connRef.current = null
  peer.destroy()
}
```

これにより、独自の`cancelled`変数も不要になった。

### 学習上のポイント

- `getUserMedia()`によるカメラ取得
- `MediaStream`の扱い
- `async` / `await`による非同期処理
- `peer.open`と`peer.destroyed`
- `useEffect`のクリーンアップ
- カメラへのアクセス許可
- HTTPSが必要となる理由

## 7. 複数スマートフォンへの対応

PC側では、複数のスマートフォンからの映像を受信する。

現在は、映像ストリームだけでなく、送信元のPeer IDもReactのstateで管理している。

```ts
const [videos, setVideos] = useState<
  { peerId: string; stream: MediaStream }[]
>([])
```

映像を受信したときには、次のように追加する。

```ts
setVideos((prev) => [
  ...prev,
  { peerId: call.peer, stream },
])
```

`call.peer`は、映像を送ってきたスマートフォンのPeer IDである。

### Peer IDを保存する理由

今回追加した文字表示では、**文字を送ってきたスマートフォンと、その映像を対応させる必要がある。**

そのため、映像ごとにPeer IDを保存する構成に変更した。

### VideoPanelコンポーネント

受信した映像は、`VideoPanel`という子コンポーネントで表示する。

```ts
const videoRef = useRef<HTMLVideoElement>(null)

useEffect(() => {
  if (videoRef.current) {
    videoRef.current.srcObject = stream
  }
}, [stream])
```

Reactの`ref`を使い、HTMLの`video`要素に`MediaStream`を設定する。

## 8. 切断時の処理

スマートフォンの映像接続が切れたときに、PC側の映像パネルを削除する。

WebRTCの`connectionstatechange`を監視し、接続状態が`failed`または`closed`になった場合に削除する。

また、PeerJSの`call.on('close', ...)`でも削除処理を呼び出す。

```ts
function removeVideo() {
  if (streamId) {
    setVideos((prev) =>
      prev.filter((video) => video.stream.id !== streamId)
    )
  }
}
```

現在の`videos`は`{ peerId, stream }`という形式なので、ストリームIDは`video.stream.id`から取得する。

### 学習上のポイント

- 接続状態の監視
- 切断時の後片付け
- Reactのstateと通信状態の同期
- `filter()`による配列からの要素削除

## 9. DataConnectionによる文字通信

今回、新しく実装した機能。

スマートフォンからPCへ、映像とは別に文字データを送信する。

### スマートフォン側

映像送信と同じ`tryCall()`内で、DataConnectionを開始する。

```ts
const conn = peer.connect(hostId)
```

接続が開いたら、接続オブジェクトを`useRef`に保存する。

```ts
conn.on('open', () => {
  connRef.current = conn
  conn.send('接続完了!')
})
```

接続が閉じたら、保存した参照を解除する。

```ts
conn.on('close', () => {
  if (connRef.current == conn) {
    connRef.current = null
  }
})
```

### PC側

PCは、DataConnectionの接続要求を`connection`イベントで受け取る。

```ts
peer.on('connection', (conn) => {
  conn.on('data', (data) => {
    // 受信した文字の処理
  })
})
```

ここでの`conn.peer`は、文字を送ってきたスマートフォンのPeer IDである。

### 学習上のポイント

- `peer.call()`と`peer.connect()`の違い
- `MediaConnection`と`DataConnection`
- `conn.send()`によるデータ送信
- `conn.on('data')`によるデータ受信
- `conn.peer`による送信元の識別
- DataConnectionは双方向通信が可能であること

## 10. スマートフォン側の文字入力と送信

スマートフォンの画面上部に、送信する文字を編集できる入力欄を設置した。

### 文字のstate管理

```ts
const [message, setMessage] = useState('ドン！')
```

初期値は「ドン！」。

入力欄では、`value`と`onChange`を使ってstateを更新する。

```tsx
<input
  type="text"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  className="mb-4 rounded border bg-white p-2"
  placeholder="送信する文字"
/>
```

### 画面タップによる送信

スマートフォン画面の親`div`に`onClick`を設定する。

```tsx
onClick={() => {
  if (connRef.current && connRef.current.open) {
    connRef.current.send(message)
  }
}}
```

これにより、画面をタップすると現在の`message`がPCへ送信される。

### 学習上のポイント

- `useState`による入力文字の管理
- Reactの制御された入力欄
- `onChange`によるstate更新
- `onClick`によるタップイベント
- `useRef`によるDataConnectionの保持
- 接続状態を確認してから送信する処理

## 11. PC側の「ドン！」表示エフェクト

今回の実習をゲーム的に楽しめるように、**スマートフォンから送られた文字を、送信元の映像上に重ねて表示する機能**を実装した。

動作の流れ：

```text
スマートフォンの画面をタップ
        ↓
conn.send(message)
        ↓
PCのconn.on('data')
        ↓
送信元Peer IDを取得
        ↓
Reactのeffectsに追加
        ↓
該当するVideoPanelに表示
        ↓
文字が上昇して消える
```

### 文字エフェクトのstate

PC側では、次のstateを使用する。

```ts
const [effects, setEffects] = useState<
  { id: number; peerId: string; text: string; x: number; y: number }[]
>([])
```

各項目の意味：

| 項目 | 内容 |
|---|---|
| `id` | 文字エフェクトの識別子 |
| `peerId` | 送信元スマートフォンのPeer ID |
| `text` | 受信した文字 |
| `x` | 映像内の横位置（%） |
| `y` | 映像内の下からの位置（%） |

### 文字受信時の処理

```ts
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
```

文字を受信するたびに、新しいエフェクトを追加する。

現在のランダム位置は以下の範囲である。

- 横位置：30〜70%
- 縦位置：下から10〜30%

当初は縦位置を10〜60%とする案だったが、最新コードでは10〜30%に変更している。

### 送信元の映像だけに表示する

`VideoPanel`に渡す際、Peer IDでフィルタリングする。

```tsx
{videos.map((video) => (
  <VideoPanel
    key={video.stream.id}
    stream={video.stream}
    effects={effects.filter(
      (effect) => effect.peerId === video.peerId
    )}
  />
))}
```

これにより、スマートフォンAから送信された文字は、スマートフォンAの映像上に表示される。

### 映像と文字の重ね合わせ

`VideoPanel`では、映像を親`div`で囲み、文字を絶対配置する。

```tsx
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
```

- `relative`：文字の配置基準となる親要素
- `absolute`：映像上に文字を重ねる
- `left`：横方向の表示位置
- `bottom`：下からの表示位置
- `text-xs`：小さめの文字（12px）
- `font-black`：太い文字
- `pointer-events-none`：文字がマウス操作を妨げないようにする

### Reactのkey

複数の文字エフェクトを配列から表示するため、それぞれに`key`を設定する。

```tsx
<span key={effect.id}>
```

`key`はReactが要素の同一性を判断するための識別子である。

配列の途中で要素が追加・削除された場合でも、既存の要素を正しく追跡できる。

`key`は再レンダリングを防ぐためのものではない。

### Reactの再レンダリング

`effects`を更新すると、stateを持つコンポーネントが再レンダリングされる。

ただし、Reactは変更された部分だけを実際のDOMに反映する。

そのため、文字を追加するたびに`video`要素が作り直されるわけではない。

また、文字の移動や透明度の変化はCSSアニメーションが担当する。

## 12. CSSアニメーションによる文字の上昇

`src/index.css`に`floatUp`アニメーションを追加した。

現在のコード：

```css
@import "tailwindcss";

@keyframes floatUp {
    0% {
        transform: translate(-50%, 0);
        opacity: 1;
    }

    70% {
        opacity: 1;
    }

    100% {
        transform: translate(-50%, -11.25cqw);
        opacity: 0;
    }
}
```

### アニメーションの動作

1. 文字がランダムな位置に表示される
2. 文字が上方向に移動する
3. 最後の30%の時間で透明になっていく
4. 1秒後には見えなくなる

Tailwindの任意値構文でアニメーションを適用する。

```tsx
className="animate-[floatUp_1s_ease-out_forwards]"
```

### cqwについて

`cqw`は、コンテナの幅を基準とするCSS単位。

親要素に次を指定している。

```tsx
className="relative [container-type:inline-size]"
```

これにより、`1cqw`が親コンテナの幅の1%となる。

現在の移動距離は`11.25cqw`である。

これは、**映像の表示領域が16:9の場合に、高さの約20%に相当する距離**となる。

映像の縦横比が異なる場合、厳密に高さの20%にはならない。

### container-typeについて

`container-type: inline-size`は、コンテナの幅を基準とするCSS指定を可能にする。

ただし、要素のサイズ計算にも影響するため、レイアウトが変わる場合がある。

`container-type: size`も試したが、親要素の高さが期待どおりに計算されず、表示が崩れたため採用しなかった。

### 現在の未対応事項

CSSアニメーションによって文字は透明になるが、**1秒後に`effects`の配列から削除する処理は、まだ実装していない。**

したがって、見えなくなった文字のデータとDOM要素は残り続ける。

今後、アニメーション終了後にエフェクトを削除する処理が必要である。

## 13. ローカル開発時のHTTPS

スマートフォンのカメラを利用するため、ローカルネットワークでHTTPS接続を試した。

Vite用プラグイン：

```bash
npm install -D @vitejs/plugin-basic-ssl
```

`vite.config.ts`で`basicSsl()`を利用する。

### 注意点

- HTTPSはカメラアクセスに必要なセキュアコンテキストを確保するため
- 自己署名証明書では、ブラウザに警告が表示される場合がある
- GitHub PagesではHTTPSが提供されるため、ローカル開発用の`basicSsl()`は不要

## 14. ネットワーク環境での問題

大学のWi-Fi環境などで、スマートフォンからPCのローカルIPアドレスにアクセスできない場合があった。

例：

```text
Address unreachable
172.16.x.x
```

これはPeerJSの接続処理以前に、スマートフォンからPCの開発サーバーへ到達できていない状態である。

### 確認事項

- PCとスマートフォンのネットワーク接続
- PCのIPアドレス
- Vite開発サーバーの外部公開設定
- Wi-Fi側の端末間通信制限
- ファイアウォール

WebRTC自体もネットワーク構成やNAT、ファイアウォールの影響を受ける。

## 15. GitHub Pagesへの公開

`vite.config.ts`にGitHub Pages用の`base`を設定する。

```ts
base: '/master-peerjs-practice/',
```

GitHub Actionsのワークフローを作成する。

ファイル：

`.github/workflows/deploy.yml`

基本的な処理：

1. リポジトリをチェックアウト
2. Node.jsをセットアップ
3. `npm ci`で依存パッケージをインストール
4. `npm run build`でビルド
5. `dist`をGitHub Pagesにデプロイ

GitHubのSettings → Pagesで、公開方法をGitHub Actionsに設定する。

### GitHub Pagesを利用する理由

- HTTPSで公開できる
- スマートフォンからURLにアクセスできる
- PCとスマートフォンが同じLANにいる必要がない
- Viteの静的アプリとして公開できる

ただし、PeerJS/WebRTCの通信成功はネットワーク環境にも依存する。

## 16. AI先生プロンプトを作る際の方針

- 学生に一度にすべてのコードを渡さず、段階的に実装させる
- 最初はPCとスマートフォンの1対1接続を目標にする
- 接続できたらQRコードを導入する
- 次にカメラ映像の送信を実装する
- 複数台の映像受信と切断処理を追加する
- その後、DataConnectionによる文字通信を導入する
- スマートフォンの画面タップで文字を送信する
- 最後に、送信元の映像上に文字を重ねるゲーム的な演出を追加する
- PeerServerとWebRTCの役割の違いを説明する
- HTTPSとネットワーク制限について学ばせる
- GitHub Pagesで公開して実機確認する

### 今回の実習で扱った主要な学習内容

- PeerJSのPeer ID
- WebRTCによる映像通信
- PeerServerによるシグナリング
- MediaConnectionとDataConnectionの違い
- QRコードによる接続先情報の共有
- Reactによる複数映像の管理
- Peer IDによる映像と文字の対応付け
- `useState`による文字エフェクトの管理
- `useRef`による通信オブジェクトの保持
- Reactの`key`とDOM要素の再利用
- CSSアニメーションとTailwind CSS
- 接続切断時の処理
- HTTPSとカメラのアクセス許可
- GitHub Pagesへの公開

## 17. 実習の到達目標と今後の課題

### 実装・検討した内容

- PCとスマートフォンのPeerJS接続
- QRコードによる接続
- カメラ映像の送受信
- 複数スマートフォンの映像表示
- 切断時の後片付け
- DataConnectionによる文字送信
- スマートフォン側での送信文字の編集
- 画面タップによる文字送信
- PC側での送信元Peer IDの識別
- 対応する映像上への文字表示
- ランダムな位置での文字表示
- 文字の上昇・フェードアウト演出
- GitHub Pagesへの公開設定

### 今後の発展課題

- **アニメーション終了後に`effects`から文字を削除する**
- スマートフォンの文字入力中にタップ送信が発生しないようにする
- 映像の縦横比に依存しない上昇距離の指定
- 接続エラーの表示と再接続
- カメラの切り替え
- 文字エフェクトの種類を増やす
- 複数人でのゲーム的な対戦演出
- WebRTCのSTUN・TURNサーバーの理解
- 受信映像への物体検出（YOLO）の導入

## 18. AI先生プロンプトへの展開

学生向けの演習は、次の順序で構成する。

1. Vite + React + TypeScriptの準備
2. PeerJSによるPCとスマートフォンの1対1接続
3. QRコードによる接続先情報の共有
4. スマートフォンのカメラ映像の送信
5. PCでの映像受信と表示
6. 複数スマートフォンへの対応
7. 接続切断時の処理
8. DataConnectionによる文字の送受信
9. スマートフォンでの送信文字の編集
10. 画面タップによる文字送信
11. Peer IDによる送信元映像の特定
12. Reactのstateを使った文字エフェクトの管理
13. Tailwind CSSとCSSアニメーションによる文字表示
14. GitHub Pagesへの公開と動作確認

AI先生は一度にすべてを説明せず、学生が各段階の動作を確認してから次に進む。

特に、**映像と文字が別々のWebRTC接続を通っていること、Peer IDによって送信元を識別できること、Reactがデータの追加・削除を担当しCSSがアニメーションを担当すること**を、重要な学習項目として扱う。

授業では、PC画面をスクリーンに投影し、学生が自分のスマートフォンで文字を送信することで、通信プログラムの動作を教室全体で体験できるようにする。

