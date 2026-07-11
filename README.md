# 割り箸カード v38 Firebase部屋同期テスト版

GitHub Pages でそのまま動かせる分割版です。

## v38の主な変更

- Firebase / Cloud Firestore に接続
- PL vs PL の部屋作成を Firestore に保存
- 部屋ID付きURLから入室可能
- ホスト/ゲストの入室状態を同期
- 準備完了/準備解除を同期
- 2人とも準備完了したことを画面に表示

## まだ未実装

- 実際の盤面同期
- ターン同期
- 手札・山札・罠の同期
- PL vs PLの試合開始処理

## Firestore

この版では `rooms/{部屋ID}` に以下のようなテスト用データを保存します。

- hostJoined
- guestJoined
- hostReady
- guestReady
- status
- createdAt
- updatedAt

## ファイル構成

- `index.html`
- `style.css`
- `game.js`
- `README.md`
