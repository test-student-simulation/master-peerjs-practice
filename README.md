# master-peerjs-practice 作業記録

## 1. 実習の目的

Vite + React + TypeScriptで、**スマートフォンのカメラ映像をPCにリアルタイム送信するアプリ**を作成する。

PCに表示されたQRコードをスマートフォンで読み取り、PeerJSを使って接続する。

最終的にGitHub Pagesで公開し、複数のスマートフォンからの映像をPC上に同時表示できるようにする。

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

`src/index.css`：

```css
@import "tailwindcss";
```

`vite.config.ts`にTailwindのプラグインを追加した。

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
                 WebRTC
```

PeerServerは接続相手を見つけるためのシグナリングを担当する。

映像は通常、WebRTCによって端末間で直接送受信される。ただし、ネットワーク環境によっては中継サーバーが必要になる。

## 4. PC側の実装

PC側でPeerJSのインスタンスを生成。

```ts
import Peer from 'peerjs'

const peer = new Peer()
```

PeerJSから一意のPeer IDが割り当てられる。

そのPeer IDをスマートフォンに伝え、接続先として利用する。

### PC側の主な処理

1. PeerJSでPeer IDを取得する
2. Peer IDを含むQRコードを表示する
3. スマートフォンからの接続を待ち受ける
4. 受信した映像ストリームを表示する
5. 複数のスマートフォンの映像を個別に管理する

## 5. QRコードによる接続

QRコード生成ライブラリを導入。

```bash
npm install qrcode.react
```

PCのPeer IDをURLのクエリパラメータに埋め込む。

```ts
const url =
  `${window.location.origin}${import.meta.env.BASE_URL}?host=${peerId}`
```

### 学習上のポイント

- `window.location.origin`：現在のサイトのオリジン
- `import.meta.env.BASE_URL`：Viteで設定した公開先のベースパス
- `?host=...`：接続先Peer IDをURLに渡す

この構成なら、ローカル開発環境とGitHub Pagesの両方でURLを組み立てられる。

## 6. スマートフォン側の実装

スマートフォンでQRコードを読み取り、URLにアクセスする。

URLの`host`パラメータからPCのPeer IDを取得する。

スマートフォンのカメラ映像を取得し、PeerJS経由でPCへ送信する。

### 学習上のポイント

- `getUserMedia()`によるカメラ映像の取得
- `MediaStream`の扱い
- PeerJSによるWebRTC接続
- カメラへのアクセス許可
- HTTPSが必要となる理由

## 7. 複数スマートフォンへの対応

1台だけでなく、複数のスマートフォンから映像を受信できるようにした。

PC側では受信した映像を個別のパネルとして表示する。

### 学習上のポイント

- Reactの`useState`による複数データの管理
- Peer IDによる接続相手の識別
- `video`要素への`MediaStream`の設定
- 接続の追加・切断に応じた画面更新

## 8. 切断時の処理

スマートフォンの接続が切れた際に、PC側の映像表示が残らないようにする処理を検討・実装した。

WebRTCの`connectionstatechange`を監視し、接続状態が`failed`または`closed`になった場合に、該当する映像を表示から取り除く。

### 学習上のポイント

- 接続状態の監視
- 切断時の後片付け
- Reactの状態と実際の通信状態の同期

## 9. ローカル開発時のHTTPS

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

## 10. ネットワーク環境での問題

大学のWi-Fi環境などで、スマートフォンからPCのローカルIPアドレスにアクセスできない場合があった。

例：

```text
Address unreachable
172.16.x.x
```

これはPeerJSの接続処理以前に、スマートフォンからPCの開発サーバーへ到達できていない状態。

### 確認事項

- PCとスマートフォンのネットワーク接続
- PCのIPアドレス
- Vite開発サーバーの外部公開設定
- Wi-Fi側の端末間通信制限
- ファイアウォール

WebRTC自体もネットワーク構成やNAT、ファイアウォールの影響を受ける。

## 11. GitHub Pagesへの公開

`vite.config.ts`にGitHub Pages用の`base`を設定。

```ts
base: '/master-peerjs-practice/',
```

GitHub Actionsのワークフローを作成。

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

## 12. AI先生プロンプトを作る際の方針

- 学生に一度にすべてのコードを渡さず、段階的に実装させる
- 最初はPCとスマートフォンの1対1接続を目標にする
- 接続できたらQRコードを導入する
- 次にカメラ映像の送信を実装する
- 最後に複数台接続と切断処理を追加する
- PeerServerとWebRTCの役割の違いを説明する
- HTTPSとネットワーク制限について学ばせる
- GitHub Pagesで公開して実機確認する

### 今回の実習で扱った主要な学習内容

- PeerJSのPeer ID
- WebRTCによる映像通信
- PeerServerによるシグナリング
- QRコードによる接続先情報の共有
- Reactによる複数映像の管理
- 接続切断時の処理
- HTTPSとカメラのアクセス許可
- GitHub Pagesへの公開

## 13. 実習の到達目標と今後の課題

**実装・検討した内容**
- PCとスマートフォンのPeerJS接続
- QRコードによる接続
- カメラ映像の送受信
- 複数スマートフォンの映像表示
- 切断時の後片付け
- GitHub Pagesへの公開設定

**今後の発展課題**
- 接続エラーの表示と再接続
- カメラの切り替え
- WebRTCのSTUN・TURNサーバーの理解
- 受信映像への物体検出（YOLO）の導入

## 14. AI先生プロンプトへの展開

学生向けの演習は、次の順序で構成する。

1. Vite + React + TypeScriptの準備
2. PeerJSによるPCとスマートフォンの1対1接続
3. QRコードによる接続先情報の共有
4. スマートフォンのカメラ映像の送信
5. PCでの映像受信と表示
6. 複数スマートフォンへの対応
7. 接続切断時の処理
8. GitHub Pagesへの公開と動作確認

AI先生は一度にすべてを説明せず、学生が各段階の動作を確認してから次に進む。

特に、PeerServerとWebRTCの役割、HTTPSの必要性、ネットワーク環境による接続制限を重要な学習項目として扱う。

※ この記録はこれまでの作業内容をもとに再構成したものであり、ソースコード全文との照合は未実施。
