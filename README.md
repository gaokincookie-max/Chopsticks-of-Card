# 割り箸カードゲーム v173a



## v173a: 仕込み・反復強迫の一時配置セッション化

- 「仕込み」は従来の手札から直接ポンポン伏せる操作感を維持したまま、カード効果が完了するまで所有する一時配置セッションへ変更。
- 相手ターン中に「びっくり箱」から「仕込み」が発動しても、カード使用済み表示に阻害されず罠を配置でき、「仕込み終了」で元の攻撃処理へ戻る。
- 「反復強迫」も同じ基盤へ統合。最初に選んだ同名呪縛だけが配置可能になり、「反復終了」まで手札から連続配置できる。
- オンラインで相手側のコピー効果として発動した配置は、攻撃側が勝手に選ばず、Decisionを通して効果の所有者本人がカードと設置先を選ぶ。
- 「びっくり箱」は引き続き記録カードの**効果のみ**を発動し、終端を無視する。そのため記録された終端効果に対する控訴・上告は発生しない。

## v173: カード名・天命テーマ表記を整理

- 「闇鍋」「不測の備え」「カードマジック」「学習」へカード名を変更。
- 天命テーマの名称を全面整理し、「信託を受ける」「輪廻する天命」「神の加護」「神意の剣」「啓示の伝播」「神意の代行」「盲信」に統一。
- カード本文、戦闘ログ、選択メッセージ、制限通知、デッキ検索・分類、動的生成される天命名、実績由来称号、過去のお知らせ・ドキュメント・テスト表記まで監査し、旧名の残存を除去。
- 内部カードID・同期用フィールド名は既存データとの互換性維持のため変更していません。


## v172a: 実績バッジ表示修正
- 未受取実績が0件でも `!` が表示されるCSS競合を修正。
- `hidden` 属性を持つ実績バッジを確実に非表示にするようにしました。

## v172: ギフト称号追加

- ギフトコード報酬として称号「最古参勢」「古参勢」を追加しました。
- 一般ギフト称号は `users/{uid}/giftTitleClaims/{titleId}` を同一transactionで作成し、コード文字列をSecurity Rulesへ埋め込まずに報酬正当性を検証します。
- 同一コードは従来どおり `giftCodes/{code}/claims/{uid}` により1アカウント1回のみです。すでに報酬を全て所有しているコードの空受取も拒否します。
- 配布コード本体はリポジトリへ埋め込まず、Firebase Consoleで `giftCodes/{code}` を手動作成します。`GIFT_CODE_SEEDS.md` を参照してください。

## v171a: 実績・熟練称号のバグ修正

- 実績称号を装備したプレイヤーが対戦部屋Rulesに拒否される問題を修正。
- 熟練度retry重複排除履歴を再送キューと同じ100件に拡張。
- 実績・称号・相手表示の破壊テスト結果は `V171A_ACHIEVEMENT_CHAOS_TEST.md` を参照。

## v171a: 実績システム第一弾 / カード熟練度

- 正式ログインユーザー限定でカード使用回数を永続記録します。CPU戦・オンライン戦のどちらも対象です。
- 使用回数は実際の使用成立時に加算します。罠・加護・呪縛は設置成功時、控訴・上告は割り込み回答が正式に受理された時点です。
- 各カードを10/50/100/500回使用すると、それぞれ「○○使い」「○○の熟練者」「○○の達人」「○○の神」を達成します。
- メニューに「実績」を追加し、達成済み/未達成の2タブと「カード熟練度」一覧を追加しました。
- 未達成一覧は1回以上使ったカードだけを、次の段階まで残り回数が少ない順で表示します。達成すると 10→50→100→500 と次の目標へ更新されます。
- 達成済み一覧は新しく達成した順で、未受取報酬に「！」を表示します。個別受取と「報酬をすべて受け取る」に対応しました。
- 実績を長押しすると条件・進捗・報酬・達成日時を確認できます。
- 熟練度加算はAction ID等で重複排除し、通信失敗時は端末内キューから再送します。
- 熟練称号は報酬受取後にのみプレイヤーカード編集で選択できます。

## v170o: 乱舞・囮・捨て身・エゴ調整

- 乱舞を通常攻撃扱いへ変更。通常攻撃で加える本数を0として解決し、攻撃後罠より前に対象の手を攻撃手と同じ本数へ置換します。
- 乱舞でも共鳴、銛、トラウマなど通常攻撃を参照する処理が進みます。
- 囮は次の自分のターン、一度だけ罠設置でカード使用回数を消費しない効果へ変更しました。
- 捨て身の反動を、その通常攻撃で相手に加えるはずだった本数-1へ変更しました。
- エゴは通常攻撃で加える本数への増減を無効にし、相手盤面効果を無視する能力はスーパーエゴのみとしました。

## v170n: 対戦部屋の破壊テスト / 切断復旧強化

- ホスト解散後にゲストの `activeRooms` が残る経路を修正。
- stale `activeRooms` を所属判定前に自己修復。
- closed room からのゲスト退出は所属ロックだけを安全に解放。
- `starting` 中に相手接続が3分確認できなければ残存開始ロックを解放可能。
- abandoned room 自動破棄後に battle 画面だけ残る経路を修正。
- 部屋状態モデルを10万ケース・2000万遷移で破壊テスト。

## v170m: 対戦部屋 / 勝敗画面の復旧強化

- 降参結果のACK待ちは維持しつつ、10秒でタイムアウトして進行可能に変更。
- `match.surrenderedAt` をserver timestampで保存し、Firestore Rules側でも10秒経過後のACK確定を許可。
- 勝敗画面の `postMatch.resolvedAction` を再適用可能にして、片側だけbattle画面に残る状態から次snapshotでロビーへ収束。
- Ready変更とGuest退出を最新roomを読むTransactionへ変更し、古いmembersの書き戻し競合を軽減。


## v170l: オンラインのターン制限と切断終了

- オンライン対戦に60秒のターンタイマーを追加。ターン開始処理がcanonicalに確定してからカウントを開始します。
- 時間切れ時は、残っている通常攻撃回数を合法な対象へランダムに自動消化してターンを渡します。
- ターン開始時刻はFirestoreへ保存するため、reloadしても60秒へ戻りません。
- heartbeatを30秒間隔へ変更し、3分間通信確認できない場合は残った側の切断勝利をTransactionで確定します。
- Firestore Rules側でも3分経過を再検証し、誤った切断勝利を拒否します。
- 詳細: `V170L_TURN_TIMER_DISCONNECT.md`

## v170k: 再読込時の孤児選択状態を自動復旧

- `handCardSelection` / `boardHandSelection` / `numberAllocation` のような汎用非同期選択は、reloadでPromise/resolve実行体が失われた場合にmodeだけを復元しないよう修正。
- 孤児選択modeは `attack` へ安全に正規化し、未確定Actionを再試行可能にした。
- Invariant Checkerも「modeがattack以外」というだけでは進行可能と判定せず、実際の選択executorの存在を確認する。
- 実ブラウザ疑似Firestore破壊テスト8シナリオと、Action/Handoff/Decisionの400万ランダム遷移を実施。

## v170j: 再接続時のcanonical完全hydrate

- reload/reconnect時も通常同期と同じcanonical snapshot適用処理を使用します。
- continuation、Action、Decision、Handoffの復旧順序を整理し、孤児Actionによる進行停止を防ぎます。
- Action開始metadataがFirestoreへ確定できない場合は行動を開始せず、再同期して安全側へ倒します。
- `v170j-reconnect-hydration-source.test.js` / `model.test.js` を追加しました。

## v170i: 予告状のsecure Decisionをatomic finalize

- `postTurnStart` から発動した「強制」「貿易」は、効果反映後のcanonical state・Decision/interactionの削除・対応する `advance-notice:N:completed` checkpoint を同一Firestore transactionで確定します。
- commit自体は成功したが応答だけ失われたretryでは、canonical Actionのcompleted step / nextIndexを確認して成功扱いにし、効果stateを再publishしません。
- 再接続時に同じ予告状indexがすでにcompletedなら再checkpointせず次のindexから復旧します。
- Firestore Rulesの変更はありません（v170b以降のRulesを継続利用）。





## v170h

- オンラインのターン開始後に発動する「予告状」を `postTurnStart` Action としてcanonical管理するよう変更。
- `turnStartAppliedSerial` の確定と同じFirestore transactionで、予告状queueを通常stateから取り除き `match.action.payload.queue` へ移します。
- 予告状1枚ごとに `advance-notice:N:completed` checkpointを盤面stateとAction metadataへ原子的に保存し、途中reload時は最後の確定地点から再開します。
- 予告状由来のオンラインDecisionにはAction/カード位置に基づく安定IDを使い、pending Decisionへの再接続で新しいDecisionを重複生成しないようにしました。
- 強制・貿易のsecure interaction作成を冪等化し、同じActionの再実行で既存interactionを上書きしません。
- 貿易は再接続時に保存済みの秘密選択を同じDecision IDから復元し、選択のやり直しによるcommit不一致を防ぎます。
- 強制・貿易のDecision結果だけ復旧した場合は、対応する予告状カードを完了checkpointして次の開始時カードへ進みます。
- Firestore Rulesは変更していません。
- 詳細: `V170H_POST_TURN_START_ACTION.md`


## v170g

- オンラインの handoff commit を完全冪等化しました。
- 初回 handoff は直前の `turnSerial / turnOwner` のときだけ盤面を更新します。
- handoff が既に成功済み、または試合がさらに先へ進んでいる場合、古い端末の retry は盤面を書き直さず成功扱いになります。
- 「handoff は成功したが応答だけ消失 → 相手が新ターン開始 → 旧端末が retry」で新ターンのドローや開始時効果を巻き戻す競合を防止しました。
- 詳細: `V170G_IDEMPOTENT_HANDOFF.md`

## v170f

- handoff bridge metadataのcanonical確定を3回まで再試行し、確定できない場合はturnOwner/stateのhandoff publishへ進まないよう変更。
- handoff publish transactionは `expectedHandoffId` / fromSide / toSide / toTurnSerial を検証し、対応するbridgeが残っている場合だけターン交代を確定。
- canonicalの `turnSerial` と `turnOwner` からhandoff成功済みを判定する共通処理を追加。
- handoff成功後に `action` / `handoff` metadataの掃除だけ失敗した場合、専用retryで再試行。
- Recovery Manager / Watchdogも成功済みの残留handoffを検出し、どちらの参加者からでも冪等にmetadataを掃除可能。
- metadata掃除ではhandoffに紐づく `actionId` だけを解除し、後続Actionを誤って消さないよう保護。
- Firestore Rulesの変更はありません。v170b以降のRulesをデプロイ済みなら再デプロイ不要です。


## v170e

- オンライン通常攻撃のActionを `attack()` 終了時に消さず、`resolveActionDone()` からhandoff確定まで保持するよう変更。
- `Action -> awaiting-handoff` と `handoff=committing` を同一Firestore transactionで記録し、「攻撃確定済み・Actionなし・handoffなし」の空白状態を排除。
- Recoveryは確定済み通常攻撃Actionを先に削除せず、そのActionを保持したままターン交代を再開。
- Invariant Checkerがローカル手番の合法な通常攻撃・分ける・カード使用・継続modeを確認し、実際に操作不能な状態を検出。
- 「行える操作なし」の自動ターン終了判定に「分ける」を含め、再同期時にも合法行動がなければ自動終了を再開。
- 複数回攻撃の途中や追加行動へ移る場合は、その攻撃Actionを正常完了してから次の操作を許可。

## v170d
- Action checkpointの盤面stateと `appliedStepIds` を同一Firestore transactionで確定し、「盤面だけ反映・適用済みmetadataだけ欠落」という中間状態を排除しました。
- checkpoint transactionは同じAction IDを検証してから盤面とAction metadataを書き込むため、古いActionの遅延書き込みや重複処理が正本を上書きしにくくなりました。
- Actionの通常完了も、手番を保持している場合は最終盤面と `match.action=null` / `lastCompletedActionId` を同一commit経路で確定します。
- Recoveryは `attack-finalized` が欠けた旧版・異常状態でも、canonicalの `attacksUsed >= attackLimit` とAction phaseを根拠に確定済み攻撃のhandoffを再開します。
- Firestore Rulesはv170b/v170cと同じです。v170b Rulesをデプロイ済みなら再デプロイ不要です。

## v170c
- 《強制》《貿易》の時間切れランダム自動選択を `timed_out + auto_random` の正常解決として最終canonical確定できるよう修正。
- Decision回答側にローカルdeadline timerを追加し、多段選択中にtimeout通知を取り逃してもUIを自動終了。
- オンラインの選択途中状態（modeと主要pending情報）をcanonical snapshotへ保存し、リロード・再同期後に復元。
- Action開始metadataを直列化し、遅延したstarted書き込みが完了済みActionを復活させる競合を防止。
- canonical snapshot schemaVersionを4へ更新。

## v170b

- 《強制》のオンライン選択が45秒で時間切れになった場合、現在の合法な通常手札から1枚をランダム自動選択して効果を続行します。
- 《貿易》の相手側選択が45秒で時間切れになった場合、現在の交換可能カードから1枚をランダム自動選択して交換を続行します。
- 《コンディショニング》は時間切れ時に追加の呪縛を置かず、その選択UIを閉じて自動スキップします。
- secure interaction に `decisionDeadlineAt` を追加し、相手端末が切断していても期限後は効果使用側が安全なtimeout fallbackを確定できるようにしました。
- Recovery再同期で terminal Decision を発見した際、`friendInterruptWaiting` を単純破棄せず、待機中Promiseへ結果を返してから掃除します。
- handoff metadata の `committing` 書き込みと完了解除を直列化し、遅延書き込みによる stale handoff 復活を防止しました。
- この版は `firestore.rules` を変更しています。オンライン公開時はRulesの再デプロイが必要です。

## v170a

- `render()` からオンラインstate publishを分離し、ゲーム状態の確定を `FriendCommitManager` に集約しました。
- カード固有の `publishFriendStateNow()` / `forcePublishFriendStateNow()` 呼び出しを撤去し、カード側がFirestore同期を直接意識しない構造へ整理しました。
- `OnlineActionManager` に `resolving / waiting-decision / committing / failed` を導入し、例外発生時はActionをfailedとして記録してRecoveryへ移行します。
- `card-effect-resolved` と `attack-finalized` をcanonical commit成功後だけ `appliedStepIds` に記録し、再接続時に同じカード効果・攻撃を二重適用しない復旧判定へ変更しました。
- `friendCardResolving / friendInterruptWaiting / friendInterruptHandling` は進行可否の正本から外し、canonicalのpending Decisionを一次情報にしました。旧フラグはUI入力抑止専用です。
- 《強制》《貿易》の秘密選択を `SecureDecisionManager` に集約しました。
- 相手手番のheartbeatが90秒以上更新されない場合は再同期状態へ入り、30分以上切断が続いた残存対戦は既存Firestore Rulesの安全条件に従って自動解除します。
- CARD_LIBRARY内からオンライン固有分岐を撤去し、今後カード効果へfriend専用処理を直接追加しないsource testを追加しました。

## v170

- オンライン進行をAction / Decision / Recoveryの共通基盤へ整理しました。
- 期限切れDecisionは質問側・回答側のどちらでもtransactionで確定でき、遅延回答は上書きできません。
- 回答側の選択UIもDecision終了時に自動解除します。
- Recovery Watchdogが期限切れDecision・turn-start claim・handoff再試行を監視します。
- 予告状などの対話型ターン開始効果はcanonical turn-start確定後に解決します。
- 通常攻撃・カード使用・handoffをActionメタデータで追跡し、再接続時の診断と復旧を強化しました。


## v169e

- オンライン割り込みに競合安全な応答タイムアウトを追加しました。通常の判断は30秒、貿易・強制・コンディショニングは45秒です。
- タイムアウトはFirestore transactionで pending 状態にだけ確定し、遅れて届いた回答が結果を上書きしないようにしました。
- 貿易・強制の時間切れ時は secure interaction / 秘密選択を後片付けします。
- 再接続時に期限切れの pending interaction を回収します。
- 受信FXで例外が起きても演出キューと入力状態を復旧し、対戦進行を止めにくくしました。

## v169d

- オンライン対戦の通常攻撃後handoff、remote interaction、貿易・強制・コンディショニングの相手ターン中選択を安定化。
- 解決済みinterruptがターン終了を止める問題、送受信失敗時の待機残留、handoff失敗時の攻撃済み状態へのrollbackを修正。
- 予告状などの効果コピーから「仕込み」を使った場合、「仕込み終了」でコピー元の処理へ正しく戻るよう修正。

## v169c

- 《アパシー》の実カード使用判定を修正し、《デバリュエーション》《コンディショニング》による効果設置では発動せず、通常使用した呪縛が《マジックミラー》で反射された場合は発動するよう調整。
- 手が0になった後に題目系特殊加護が復元される際、《コンプレックス》へ新規設置として通知しないよう修正。
- 題目復元状態をfriend戦のcanonical stateへ同期。

## v169b

- びっくり箱の効果完了待ちと攻撃後発動条件を修正しました。
- 孤立、アパシー、フィクゼーション、コンプレックスの設置物連携を改善しました。
- 呪縛の捨て札ルーティング、エゴ系の盤面無視、オンライン選択を安定化しました。

## v169a

- グリーフ、ホメオスタシス、ターン終了時設置効果の処理順を修正しました。
- デバリュエーションの満杯時置換と加護インスタンス選択を修正しました。
- エゴ／スーパーエゴの防御側盤面効果無視と、フラッシュバックの個体履歴管理を改善しました。

## v169

- 心理学をモチーフにした通常カード15枚と生成カード「スーパーエゴ」を追加しました。
- 呪縛の設置者、正しい捨て札所有者、呪縛履歴、固定・退避状態を共通管理する基盤を追加しました。
- びっくり箱、起爆、強制起爆、置き土産の本文を実際の処理に合わせて改善しました。

## v168a

- 起爆・強制起爆で過剰反応と逃走装置が正しく効果を解決するよう修正しました。
- 起爆途中で手が0になった場合、右側の未発動罠を通常どおり破棄するよう修正しました。
- びっくり箱のpayload解決後、後続罠が残っている場合だけ起爆を続けるよう調整しました。

## v168

- 罠テーマを大幅更新し、反撃・囮・スワンプマンなど既存罠を調整しました。
- 起爆、強制起爆、びっくり箱、過剰反応、偽装工作、残骸回収、自爆を追加しました。
- 置き土産をリワークし、独立カウントを持つ生成カード「時限爆弾」を追加しました。

## v167b

- compact表示をPC・iPadで最大4列へ調整しました。
- カードロックを1～2枚選択へ変更し、援護射撃を狙撃系防御の対象にしました。
- 闇鍋の使用回数返却と対象不存在時の安全性、過加速反動中のドロー計算を改善しました。
- 狙撃の加護付きの手を通常攻撃元として選択できないようにしました。

## v167a

- お気に入りカードを常に一覧上部へ表示し、ボタンを右上固定の♡／♥へ変更しました。
- コンパクト表示を基本2行のレスポンシブ多列グリッドへ高密度化しました。
- フィルター選択時の背景と枠線を控えめに調整しました。

## v167

- 「覗き見」の結果を、使用者だけが確認できる専用カード一覧モーダルへ変更しました。
- デッキ編集を名前・本文・種類・テーマの全文検索と複合フィルターに対応しました。
- デッキ詳細での枚数増減、お気に入り、設定保存されるコンパクト表示を追加しました。

## v166c

- オンラインinteraction中はcanonicalな`match.interrupt`も参照して、攻撃・カード・分割・ターン終了・自動handoffを停止します。
- 「強制」「貿易」は最終効果のcanonical publish成功後にinterruptをclearします。
- コード入力・名前変更・プレイヤーカード編集を、account親モーダルと同時表示しない親子遷移へ変更しました。

## v166b

- オンライン「強制」を既存interruptへ統合し、対象プレイヤー本人が選択します。
- オンライン「貿易」にSHA-256 commit/revealと参加者本人専用の秘密選択文書を追加しました。
- pending interactionはmatch/action IDで検証し、再接続時に待機・解決状態を復元します。

## v166a

- v166新カードの人間向け対象選択を既存の手・カード選択UIへ統合しました。
- CPUは有限候補からの自動選択を維持します。
- 「遅刻」の予約値を天命補正と同じ最終attackLimit計算へ統合しました。

## v166 新カード14枚・手札共通属性

- `countsAsHandCard`、`discardable`、`consumesCardAction`、`vanishOnUse`、`vanishAtTurnEnd` と共通card instance identityを追加しました。
- 新カード14枚とCPU・オンラインsnapshot対応を追加しました。
- 捨て候補を有限集合として先に抽出し、捨てられないカードだけでも全捨て・ランダム捨てが停止するよう安全化しました。

## v165n オンライン降参通知・結果同期修正

- 降参された側に約1.8秒の自動通知を表示し、演出終了ack後に双方の勝敗画面を開くよう変更しました。
- ack前の降参者には待機表示だけを出し、試合後の3択へ進めないようにしました。
- 降参理由・降参者・ackを勝敗UIより先に同期し、通常勝利の本文が誤表示される問題を修正しました。
- Firestore Rulesにwinner専用の狭いack更新経路と、ack前post-match禁止を追加しました。

## v165m オンライン試合UI・降参・試合後導線修正

- オンライン試合中のメニュー、テストドロー、リセットをUIとhandlerの両方で無効化し、オンライン専用の確認付き「降参」を追加しました。
- 降参結果は同一match・未確定結果・参加者本人をtransactionで確認し、相手の勝利としてFirestoreへ確定します。
- 「再戦」だけ双方を待ち、デッキ編集または試合部屋復帰は片方の選択で即時解決するようpost-match処理をatomic化しました。
- デッキ選択者はroom lobbyへの復帰を受信してから、元の対戦ルールを維持したデッキ編集画面へ移動します。
- 全休符のターン開始ポップアップに残っていた「1枚使用すると終了」という旧説明を修正しました。

## v165l ターン交代・全休符・共鳴修正

- オンラインのターン開始直後に行動不能・終端・no-actionsで即終了する経路でも、turn-start appliedを先に確定してからhandoffするよう修正しました。handoff失敗時はローカルstateを直前へ戻し、失敗時だけ診断情報を出します。
- 全休符は阻害弾の状態を流用せず通常ドローを独立して封じ、通常攻撃をターン全体で禁止したまま、本来のカード使用可能回数と追加使用権をすべて使えるよう修正しました。
- 全休符によるrender内の自動終了予約を廃止し、共通の合法カード／行動判定とCPU action loopから終了します。
- 共鳴判定は攻撃手が1以上なら対象0も共通判定へ通し、共鳴調節付き1対0のディソナンスで共鳴するよう修正しました。通常攻撃の0手対象禁止は維持します。

## v165k オンラインロビー修正

- Firestore Rulesの更新判定をroom status別のhot pathへ分離し、ロビーの準備完了・解除、heartbeat、参加、退出、解散がplaying用turn lifecycle検証を通らないよう修正しました。
- 準備解除済みなら不要なFirestore writeを行わずデッキ編集へ進み、準備解除writeが失敗した場合はロビーに留まってエラーを表示します。
- 既存ルーム確認用の`socialConfirmModal`をルーム作成モーダルより前面へ固定し、入力内容を維持したまま確認・キャンセルできるようにしました。

## v163c 孤児ルーム自己修復

- アカウント読み込み時に `activeRooms/{uid}` を確認し、存在しない・closed・自分がもう所属していない room を指す古い所属ロックを自動削除します。
- 現行方式の `activeRooms` を持たない自分の古い公開ルームが残っている場合は、起動時に安全に解散処理を試みます。
- 公開ルーム一覧更新時、10分以上更新されていない候補を確認し、host/guest のどちらにも対応する `activeRooms` がない場合だけ orphan room として closed 化できます。
- room 本体が消失・closed・非公開・満員などで公開一覧として不整合になった `publicRooms` は、安全条件を満たす場合に自動整理します。
- `roomCodes` が存在するのに対応 room が消えている場合、コード利用時に古い mapping を自動整理します。
- 一時的なリロードや通信切断で部屋を消さないため、公開 orphan cleanup には10分の猶予を設けています。

- 既存ルーム所属中に別ルームへ入ろうとした場合、ホストは解散、ゲストは退出の確認を表示してから切り替えるようにしました。
- 公開ルームの「参加」も同じ切り替え処理を通ります。
- 新規ルーム作成時のホスト解散処理を、まず room を closed にしてから publicRooms / roomCodes / activeRooms を片付ける順序へ変更し、解散が完了しない問題を修正しました。
- 無効な部屋・満員・対戦中の部屋では、現在のルームを抜ける前に参加不可を判定します。

## v163a オンラインルーム・固定修正

- 「固定」が相手ターン開始時に天命系の分ける禁止処理で消える問題を修正。CPU戦・フレンド戦とも、既存の固定予約と天命予約を合成してそのターンだけ有効にします。
- `activeRooms/{uid}` を追加し、1アカウントにつき同時に1つのオンラインルームだけ所属できるようにしました。
- 既存ルームがある状態で新規ルームを作る場合は、ホストなら解散、ゲストなら退出の確認を出してから切り替えます。
- ルーム所属中はフレンド対戦の新規招待を送信できません。受信招待を承認する場合は現在ルームの解散/退出を確認してから移動します。
- 公開ルーム一覧とロビーの部屋名・ルール・タグに独立した背景プレートを付け、文字が背景へ埋もれないようにしました。
- アカウント/フレンド操作を常時固定表示からメインメニュー内へ移動しました。

## v163 不変の呪縛・防弾チョッキ調整

- 「不変の呪縛」は、付いている手が通常攻撃するとき、その通常攻撃で加える本数への増減を無効化する本来の仕様へ修正。
- 「防弾チョッキ」は「狙撃」に加えて、「銃」カードによる攻撃を防ぐよう変更。
- 「乱射」で「ロジックアトリエ」を捨てた場合は従来どおり防弾チョッキを貫通する。


## v162b battle invite lifecycle hardening

- guestのroom参加完了後、battleInviteを`completed`へ終端してbest-effortで削除します。
- 古い`accepted`招待は新しい`pending`招待を塞がず、一定時間を超えたhandoffはcleanup対象になります。
- `roomReady=true`は、対応roomがprivate / lobby / 空席 / 招待rule一致の場合だけ許可します。

## v162a friend invite handoff / VS player cards

- 招待の`accepted`と実room作成完了を`roomReady`で分離します。受信側は`roomReady=true`までroomを読まず、送信側だけがFirestore auto IDのprivate roomを作成します。
- フレンド戦もinternal room IDはFirestore auto ID、共有用shortCodeは6文字です。invite単位のbusy・completed・timeout guardで重複snapshotと無限待機を防ぎます。
- 通常のフレンド一覧・招待toast・VS・先攻表示にはdisplayNameまたはguestLabelを使い、publicIdはプロフィール、検索、申請確認など識別が必要な画面だけに表示します。
- VSはbackground、overlay、frame、content、title slotを分離したplayer-card componentです。PCは自分左／相手右、mobileは相手上／自分下。表示完了後にhostだけが先攻を抽選し、表示済みmatchはreconnectで再生しません。

## v162 online rooms

- ルーム作成時に部屋名、公開／非公開、対戦ルール、固定タグ（最大3個）を設定します。空欄の部屋名は表示名から自動生成されます。
- `rooms`は実対戦state、`roomCodes`は6文字の共有ID、`publicRooms`は公開検索用metadataとして分離します。`rooms`の一覧取得は禁止のままです。
- 公開一覧は最大50件を手動更新し、ルールと複数タグ（AND）で絞り込めます。クイックマッチも最新候補を再取得し、最終参加はroom transactionで競合判定します。
- v162の有効ルールは`standard@1`のみです。room作成後のvisibility、roomName、tags、regulationは変更不可で、試合開始時に`match.regulation`へ固定コピーします。
- フレンド対戦招待でもルールを送信時に固定し、受信toastへルール名を表示します。

## v161c private room read policy

- 認証済みの参加候補者は、room IDを指定した場合に限り、ホストだけがいる参加可能なlobbyを直接取得できます。
- guest参加後のlobby、starting、playing、closedは現在のhost/guestだけが取得できます。
- `rooms`の一覧取得は引き続き禁止です。room作成は事前readを行わず、Firestore成功後だけロビーUIへ遷移します。

## v161b Firestore listener / room connection fixes

- friendRequest・battleInviteの受信／送信listenerは、`toUid == currentUid`または`fromUid == currentUid`の単方向queryを使い、Security Rulesも各分岐を個別に許可します。第三者listや全件readは許可しません。
- 新規roomは存在しないdocumentを事前readせず、Firestore create成功後だけlocal room state・URL・listener・ロビーUIを確定します。通常作成はFirestoreの自動document IDを使います。
- room IDを知る認証ユーザーのdirect getはjoin判定用に許可し、rooms collectionのlist/queryは拒否します。
- room listenerには8秒timeoutと画面内エラー表示を設け、create/join/leave/closed時のlocal state・listener・URL cleanupを統一しました。

## v161a lobby fixes

- PCロビーとVS演出は常に自分を左、相手を右に表示します。幅600px以下では相手を上、自分を下に表示します。
- 先攻はVS演出が完了してからホストだけがtransaction内で1回決定します。ゲストは保存済み結果を待ち、再接続では再抽選もVS演出の再生も行いません。
- 先攻ルーレットと結果表示はhost/guestの役割名ではなく、双方の表示名（匿名時はゲストラベル）を使用します。
- ロビー中は各プレイヤーが自分のready・deck・member readyだけを更新できます。試合開始、先攻確定、試合後のlobby復帰、room終了はホスト専用です。

## v161 persistent battle lobby

- オンラインルームは `lobby / starting / playing / closed` の状態を持ち、試合終了後も同じRoom IDで維持されます。
- `members.slot0 / slot1` に参加者のUID、表示名、準備状態を保持します。正式アカウントは通常の表示名、匿名ユーザーは再接続でも維持される `ゲスト#00000` 形式です。
- 自分のデッキ名はローカルロビーだけに表示し、相手やFirestoreへは共有しません。双方が準備完了した後、ホストだけが試合を開始できます。
- 1試合ごとに新しい `currentMatchId` と `matchSequence` を発行し、開始時にVS演出を1回だけ再生します。再接続ではVS演出を再生しません。
- ゲスト退出時はゲスト枠だけを空け、ホストの明示操作時のみルームを `closed` にします。ページ再読込や一時切断ではルームを閉じません。
- 対戦招待の辞退・期限切れ・取消後は、非アクティブな招待を削除して再送できます。

## v160 social / auth

- friendRequestとbattleInviteの重複確認は、存在しない決定的IDを直接getせず、`fromUid`・`toUid`で当事者を限定したqueryを使用します。逆方向blockは引き続きRulesだけが確認します。
- Firebase Authの初期状態復元を`authStateReady()`（未対応時は`onAuthStateChanged`初回通知）で待ち、ユーザー不在が確定した場合だけ匿名認証を開始します。
- 「ログイン状態を保持する」がONなら`browserLocalPersistence`、OFFなら`browserSessionPersistence`を使用します。パスワード・credential・tokenは独自保存しません。
- social/account UIは暗背景上の本文、補助文、input、placeholder、buttonへ明示的な高コントラスト配色を適用します。

## v159b player tags / symmetric friends

- `displayName`は重複可能ですが、5桁tagは全アカウントで一意です。公開IDは引き続き`displayName#tag`、内部主キーはFirebase UIDです。
- `playerTags/{tag}`をプロフィールと同じtransactionで作成し、双方をSecurity Rulesの`getAfter()`で相互必須にします。SHA予約方式は使用しません。
- friend承認は双方のfriend document作成とpending申請削除を同一batchへ要求します。解除・block時も双方friend documentの同時削除を要求します。

## v159a social security fixes

- クライアントは自分の`blocked`だけを読み、逆方向blockはSecurity Rules内だけで判定します。
- friend作成はpending申請の受信者だけに許可し、申請送信者による自己承認を拒否します。friend削除は従来どおりpairのどちらからでも可能です。
- friendRequest、friends、battleInviteの複製表示情報を`users/{uid}`の公開プロフィールと照合します。
- battleInviteの期限はFirestore Timestampの`expiresAt`だけを正本とし、作成時は最大61秒、承認時は未期限切れであることをRulesでも検査します。

## v159 アカウント・フレンド

- 従来どおり匿名認証ですぐ遊べます。Googleまたはメール／パスワードを追加すると、現在の匿名ユーザーへcredentialをlinkしてUIDとゲームデータを引き継ぎます。ログアウト後は新しい匿名認証へ戻ります。
- 公開プロフィールは`表示名#5桁タグ`です。表示名は重複可能、5桁タグは全アカウントで一意です。メールアドレスはFirestoreへ保存せず、`playerTags/{tag}`をprofileと同じtransactionで確保します。
- `users/{uid}/friends`、`friendRequests`、`users/{uid}/blocked`でフレンド申請・承認・拒否・解除・ブロックを管理します。ブロック中は申請・招待・フレンド化を許可しません。
- フレンド対戦招待は60秒有効です。承認transactionでroom IDを一度だけ確定し、送信者が既存`rooms`を作成、受信者が同じroomへ参加します。二重承認や重複room作成を防止します。
- 公開するのはUID・公開ID・表示名・装飾用IDだけです。認証メール、パスワード、credentialはUIやFirestoreの公開プロフィールへ含めません。

## ATTACK / TRAP CORE RULES

- 「攻撃」は上位概念で、「通常攻撃」「カード攻撃」「置換攻撃」に分類します。罠へ正式対応するカード攻撃は「乱射」、置換攻撃は「乱舞」です。
- 「通常攻撃」は正式名称です。カード効果から発生する内部通常攻撃も意味上は同じ通常攻撃で、カード本文では区別しません。行動回数の消費は各カード固有仕様を維持します。
- 自分の手から自分の手への通常攻撃も通常攻撃です。「相手」は明確に相手限定の効果だけで使用し、汎用効果は「攻撃対象」「攻撃してきた手」で判定します。
- 通常攻撃力は `basePower + attackModifier = finalAttackPower` で確定し、その後に守護などの防御側補正を適用して `receivedAmount` を決定します。
- プレイヤー向け本文では原則として「攻撃力」を使わず、攻撃側の `attackModifier` を「通常攻撃で加える本数」、防御側の `receivedAmount` 補正を「この手が受ける本数」と表現します。
- 「不変の呪縛」は、その手への通常攻撃の `attackModifier` を正負とも無効化します。素の攻撃力、攻撃置換、守護などの `receivedAmount` 補正には干渉しません。
- 「ゴールドラッシュ」は通常攻撃の加算量置換です。「乱舞」は通常攻撃ではなく、攻撃対象の値を攻撃手と同じにする置換攻撃です。攻撃行動回数は消費しますが通常攻撃履歴には含めず、通常攻撃限定効果も発動しません。
- 乱舞は対象変更・攻撃無効・攻撃後反応の罠を受け付けます。加える本数・受ける本数の補正は結果へ加えず、「ぬかるみ」は候補外・不成立・非消費です。1攻撃1罠は通常どおり維持します。
- 「成長」は、その手の通常攻撃によって最終攻撃対象を5にした瞬間、通常の5→0処理より先に1枚引きます。乱舞は通常攻撃ではないため発動しません。
- 罠は1回の攻撃につき1枚までです。手動罠を先に選択し、手動罠を使わなかった場合だけ自動罠を1枚発動します。加護・呪縛の常時効果はこの制限とは別枠です。
- 「天命：連撃」失敗の攻撃回数-1は、次の自分ターン開始時に消費し、その次の自分ターンへ持ち越しません。

## v156 銛テーマ小修正

- friend snapshotでは銛の所有者を`host` / `guest`のcanonical sideとして保存し、各端末で正しい`human` / `cpu`へ復元します。
- 「銛を埋める」は次の通常攻撃直前、対象変更後の最終対象へ銛を付与します。その攻撃自身で振動+1・初回ドロー・二連削・銛共鳴を成立させられ、後から空振りで無効化されても銛は残ります。
- 銛回収時は呪縛枠と対象手を黄白色に発光させ、細かな振動と`銛-振動:N`の強調後に本数を反映します。

## v155 天命テーマを大幅強化

- 新天命「殲滅」「連撃」「定数」と、既存天命の新しい達成／未達成効果を追加しました。
- 指定を引き直す「再解釈」、全天命を達成扱いにする「盲信」を追加しました。
- 累計10回の天命達成から「神意の証明」を経て、終端カード「DEUS VULT」へ到達できます。累計CLEARは戦闘中の手札付近に表示され、新しい試合・再戦では0へリセットされます（同一試合へのfriend再接続では維持）。
- DEUS VULTは宣告演出を完全に終えて通常盤面へ戻ってから、各hitを間隔を空けて順番に処理します。
- ロンド選択中は、まだ使用していない実効輪舞曲カードに小さな♪を表示します。通常形と演舞強化形は別カードとして判定します。
- カノンは次の通常攻撃を通常どおり成立させ、罠・対象変更・不変・守護等を処理した後の最終対象と「本来加える本数」を保存します。その攻撃で盤面へ実際に加える本数だけを0にし、攻撃履歴や攻撃そのものへの反応は維持します。次の相手ターン終了時に保存amountを純粋な遅延加算として出力し、罠・補正は再計算しません。記録対象が0なら不発で、0の手を復活・再ターゲットしません。乱舞は通常攻撃ではないためカノン予約を消費しません。
- ダブルダブルの追加行動は通常の`attackLimit`とは別枠です。通常攻撃枠を使い切った後でも、追加行動として攻撃または分けるのどちらかを1回行えます。
- ラクリモーサと強化形レクイエムは、追加使用権が残っていても使用後に必ずターンを終了する終端カードです。
- 天命の累計達成数、次ターン効果、再解釈済み個体をfriend戦でも同期します。
- DEUS VULTは宣告を表示してから、各hitの対象選択・本数処理を順に解決します。
- 通常攻撃可能回数が残っておらず、現在使用可能な手札カードもない場合、分けるが可能でもターンを自動終了します。この判定はターン開始時だけでなく、カード効果の完全解決後にも行われます。

## v154 ターン通知・オンライン演出を改善

- 闇鍋で「題目設定」の効果を抽選可能にし、予告状では引き続き予約対象外としました。
- Appassionatoへ次の自分ターンのカード使用不可を追加しました。
- ターン開始時の行動制約を、対象者・原因・制限内容が分かる共通ポップアップで通知します。
- friend戦で魔法少女の詠唱PHASE 1～3とCHANT COMPLETEを双方へ同期します。
- 演舞Ⅴ以上で強化中の輪舞曲カードを淡い水色の外周発光で表示します。

## v153 選択UIを改善

- 手を選ぶ効果を盤面上の手を直接クリックする操作へ統一。
- 題目設定・変調・フェルマータの選択をゲーム内カードパネルへ変更。
- 満ちる心は実際の手札カードを選択し、アルペジオは「分ける」と共通の配分UIで操作。
- ゲーム進行中の`confirm()`・`prompt()`・`alert()`を撤去。

## v152 輪舞曲・弾丸カード調整

- 回収弾を山札回収へ変更し、不発弾をコスト0、減装弾を2本以上の手だけが対象となるよう調整。
- Lacrimosaへ終端を追加。
- ポルタメント／プレストと、演舞Ⅴ以上の強化形ディソナンス／スフォルツァントを追加。
- 凶弾とディソナンスが共有する内部通常攻撃基盤を追加し、共鳴判定を攻撃開始時の本数へ固定。

## v151 題目・演舞システム再調整

- 演舞の最大値をⅥへ変更し、Ⅴ以上の間は輪舞曲の強化形態を維持。
- 題目：ロンドの初使用ボーナスを+2へ変更し、変化前後のカードを別履歴として管理。
- 題目設定使用後に、手札からカードをもう1枚使用可能。
- リタルダントは相手の0ではない両手を最低0まで1本ずつ減らし、次の相手ターン中の全ドローを禁止します。
- 「天命：指定攻撃」「対象指定」「沈黙」「再編成」「殲滅」「連撃」「定数」のデッキ構築コストはすべて1です。ランダム指定・再解釈済み派生も同じコストを引き継ぎます。
- Lacrimosa／Requiemの使用ターン、Andanteのコストを調整。
- 全休符が罠・加護・呪縛を使用不能と誤判定する問題を修正。

## v150 対戦開始演出・フレンド戦表示改善

- 新しい試合の先攻を50:50で決定し、確定済み結果を示す先攻ルーレットを追加。
- friend戦ではホストが先攻を1回だけ抽選して同期し、再接続時は保存済み結果を維持。
- friend戦の盤面・ターン・ログ表示をホスト／ゲスト表記へ統一。
- 試合開始時、先攻はランダムに決定されます。
- friend戦はFirebase Anonymous Authenticationを使用します。メールアドレスやパスワード入力は不要です。

### Firestore本番Rulesへの移行

1. Auth対応版ゲームを先に公開し、匿名ログイン後に新規roomへ`hostUid`、参加時に`guestUid`が保存されることを確認します。
2. `firestore.rules`をFirebase Consoleの「Firestore Database → ルール」へ貼り付けます。
3. 内容をレビューして「公開」を押します（このリポジトリから自動デプロイはしません）。
4. 別ブラウザセッションから入室し、ready・試合開始・先攻ルーレット・再戦を再確認します。

本番Rules公開後、匿名Auth未対応または旧書き込み形式のキャッシュはFirestoreへ接続できません。v159bでは`game.js?v=159b`と`style.css?v=159b`を使用します。新しいHTML・JavaScript・CSSの配信を確認してからRulesを公開してください。

基本の本数処理は5本で0になり、5を超えた場合は超過分を引き継ぎます（6→1、7→2）。

## v149 輪舞曲追加拡張

- Agitato／Doloroso／Lacrimosaと、演舞Lv.ⅤでのFurioso／Appassionato／Requiemへの動的強化を追加。
- Morendo／Grandiosoを追加。
- Furiosoの複数回通常攻撃、Appassionatoの追加カード使用、Requiemの固定対象全破棄に対応。

## 共鳴テーマ拡張

- v147銃3種の本数追加へ守護・加護軽減を適用。
- 題目設定、題目：セレナーデ／ロンド、演舞Ⅰ～Ⅵを追加。
- 輪舞曲としてフェルマータ、カノン、4分休符を追加。
- 演舞Ⅴ以上の間はリタルダント、アルペジオ、全休符として動的に強化。
- アンコールと終端カード「ダ・カーポ」を追加。

## 銃・弾テーマ拡張

- `gun: true` による「銃」カテゴリを追加。乱射・凶弾・無差別射撃・ショットガン・ファニングが対象。
- 再装填を捨て札の銃カード全般の回収へ拡張。
- 新規銃：無差別射撃（2）、ショットガン（2）、変調（1・銃サポート）、ファニング（3）。
- 弾カード：回収弾（1）、減装弾（2）、曳光弾（2）、不発弾（0）、阻害弾（1）、粉砕弾（1）。
- 複数の弾を捨てる場合も、カード効果による破棄として1枚ずつ誘発を完全解決。
- ファニングは開始時の全弾を捨て、射撃回数だけ最大6回に制限。

## お知らせ整理

- 終了した大会告知と専用の画面・処理・装飾を削除。
- ゲーム内のお知らせにv142〜v146の更新履歴を追加。
- 最新のお知らせをv146へ更新。

## 捨て札時効果・乱射・凶弾の統一

- カード効果による手札破棄を共通化し、弾の捨て札時効果を統一して処理。
- 疲労による破棄だけは捨て札時効果を発動しない仕様を維持。
- 乱射で別個体の乱射を捨てられるよう修正し、闇鍋時はコピー元の1枚だけを除外。
- 凶弾の攻撃判定を通常攻撃処理へ統合し、攻撃回数を消費せず通常攻撃補正を適用。

## 闇鍋・予告状の安全化とアンダンテ修正

- 闇鍋・予告状で通常使用条件を迂回しても、効果成立条件と対象条件を再判定。
- 対象が存在しない選択式効果が選択モードへ入り、操作不能になる問題を修正。
- アンダンテに混入していた無関係なstate初期化を除去。
- 予告状で弾を捨てた場合も、共通の捨て札時効果を処理。
- 複数回攻撃中の表示を実際の効果名に対応。

## 空間切断 × 空振り 修正

- 空間切断の2回目の通常攻撃を「空振り」などで無効化された場合、さらにもう1回攻撃できてしまう不具合を修正。
- 攻撃が命中したかどうかに関係なく、「攻撃を試みた時点」で空間切断の攻撃回数を1回消費するよう統一。
- 2回目が無効化された場合はそのまま追加攻撃を終了。
- フレンド対戦の途中同期にも対応。

## 複数回攻撃の攻撃回数消費・同期の共通化

- 通常攻撃の試行完了処理を共通化し、命中・無効・置換を問わず攻撃回数を1消費するよう修正。
- ねこだまし、乱舞、対象消失、攻撃力0でも複数回攻撃の残り回数を正しく更新。
- 複数回攻撃の途中結果を効果名に依存せずフレンド対戦へ同期。
- ゴールドラッシュの基本本数置換を「不変の呪縛」の攻撃力上昇制限から分離。
# v156「黄針が刻む振動の果て」

新テーマとして、通常カード9枚と生成呪縛「銛」を追加しました。銛は各プレイヤーが1本まで所有でき、付着した手へ通常攻撃が命中するたび「銛-振動」が増えます。そのターン最初の命中では攻撃側が1枚引きます。

銛は移動しても所有者・振動・同一ターンのドロー済み状態を保持します。「回収」すると現在の付着先へ振動分をカード効果として加算して消滅しますが、解呪など回収以外の除去では振動は発動しません。黄蜂針は次の自分ターン開始時、グングニルは使用ターン終了時に回収します。

## v164 プレイヤーカード・ギフトコード

- 正式プロフィールは`backgroundId`、`titleId`、`unlockedBackgroundIds`、`unlockedTitleIds`を持ちます。旧プロフィールは標準5背景と`rookie`を所有するfallbackで読み込みます。
- v164cでは旧・未知の選択IDを`default` / `rookie`へcanonicalizeし、所有配列から未知IDだけを除去します。既存の`gold` / `operator`は保持しますが、migrationから新規付与はできません。
- v164fではactiveRoomsから現在のルームへ復帰できます。lobbyでは復帰・解散/退出・キャンセルを選べ、starting / playingでは対戦へ戻れます。相手heartbeatが30分以上途絶えた対戦だけ、確認後に破棄できます。
- v164fでは外部効果による手札破棄と設置除去を共通保護判定へ統一しました。`protectedSpecial`・充電は手札破棄候補外、`themeBlessing`は外部除去・移動・交換候補外です。
- v165では特殊ルール定義を共通化し、「ロマンギミック杯」を追加しました。双方3ターンの準備中は攻撃事実・回数・共鳴を維持しつつ、相手側への本数変更・手札破棄などを遮断します。ルール別デッキ制約、ルール詳細、オンライン同期済みの個人ターン数から導出する準備表示にも対応しています。
- v165aではルール別デッキ編集の追加操作を修正し、CPU戦でも共通ルール定義から対戦ルールを選べるようにしました。
- v165bではオンライン対戦のターン開始状態を即時同期し、古いsnapshotによるカード・攻撃行動権の巻き戻りとロマンギミック杯の準備ターン表示差を修正しました。
- v165cではroomの`turnSerial` / `turnOwner` / `turnStarted`を正本に現手番本人だけが開始claimする方式へ変更し、初回ドロー欠落と二重開始を防止しました。ロマンギミック杯ではリタルダントをルール側のデッキ投入不可カードへ移しました。
- v165dでは試合途中の再接続を現在の`turnOwner`から復元し、未開始turnの限定再claim、旧matchの遅延publish遮断、ロマンギミック杯準備中の相手盤面値保持、CPU設置カードのルールguardを追加しました。
- v165eではturn claimと開始state適用を分離し、`turnStartAppliedSerial`と期限付き実行tokenによりclaim直後のreload/crashから一意に復旧します。開始stateとapplied markerは同じtransactionで確定します。
- v165fではturn-start適用中をatomic sectionとして隔離し、canonical commit前の通常state publishを延期します。FXとinterrupt書き込みはtoken付きqueueへ保持し、commit成功端末だけが送信します。
- v165gではturn-start由来の自動効果・自動終了を完成させたstateとapplied markerを同じcommitで確定します。v165fのatomic section、FX/interrupt queue、token guardは維持します。
- v165hでは正常commit済みturn contextを明示的に記録し、自動handoff後も旧turn由来のFX／interruptだけをtoken検証付きで1回flushします。
- v165iではFirestore Rulesの予約語による構文エラーを解消し、通常match更新を完全な検証付きhot pathとして先に評価してRules式数上限によるhandoff拒否を防ぎます。
- v165jではリタルダントを生成カード属性へ統一し、ロマンギミック杯のデッキ禁止対象を進化元のフェルマータへ修正しました。今後は整数版・枝番ともゲーム内お知らせを更新します。

## Firestore Emulatorテスト

成果物単体で`pnpm install`後に`pnpm test:rules:emulator`を実行できます。Java 21以上が必要です。テストは実際の`firestore.rules`をFirestore Emulatorへロードし、host/guest handoff、claim、applied、recovery、自動handoff、不正遷移、ロビー復帰・再戦開始を評価します。
- アカウント、対戦ロビー、VSカットインは同じ背景・称号定義を使用します。装飾は操作レイヤーの背後に置き、名前と準備状態へ暗い可読性プレートを付けます。
- `giftCodes/{code}`を正本とし、本人の`claims/{uid}`と報酬所有配列をtransactionで同時更新します。コード全件listと他人claimの取得は禁止です。
- 名前変更はtagとUIDを維持し、users、playerTags、相手側friend cacheを同じbatchで同期します。
- 有効な`activeRooms/{uid}`がある間は名前・装備中背景・称号を変更できません。コード受取は装備snapshotを変えないためroom中も可能です。

### WARIBASHI_ADMIN seed

Firebase Consoleで`giftCodes/WARIBASHI_ADMIN`を作成します（本リポジトリから自動deployしません）。

```json
{
  "active": true,
  "type": "unlimited",
  "usedCount": 0,
  "rewards": {
    "titleIds": ["operator"],
    "backgroundIds": ["gold"]
  }
}
```

停止時は`active:false`へ変更します。期限を設定しない場合は`expiresAt`を省略してください。現在Rulesで直接付与を許可する特殊報酬は`operator`と`gold`だけです。新しい報酬種別を追加する際はRulesの報酬検証も同時に拡張します。
## v173b
オンラインのターン交代が同期待ちで停止した際の診断・自己復旧を強化しました。handoff前にFirestore正本のowner/serial/Action/handoffを検査し、不一致時はcanonicalへ再同期します。permission-deniedは通信待ちと混同せず、Firestore Rules確認が必要と表示します。詳細は `V173B_HANDOFF_DIAGNOSTICS_RECOVERY.md` を参照してください。

## v173b
オンラインのターン交代が同期待ちで停止した際の診断・自己復旧を強化しました。handoff前にFirestore正本のowner/serial/Action/handoffを検査し、不一致時はcanonicalへ再同期します。permission-deniedは通信待ちと混同せず、Firestore Rules確認が必要と表示します。詳細は `V173B_HANDOFF_DIAGNOSTICS_RECOVERY.md` を参照してください。


## v173c
- オンラインのターン開始ドロー・開始時効果がcanonicalへ確定するまで操作を完全ロック。
- 未適用ターンでのカード使用・攻撃・分ける・ターン終了を入口でも拒否し、handoffのRules拒否を防止。


## v173d

- オンラインのターン開始同期を収束型へ変更。
- claim再試行2回上限を撤廃し、Firestore正本をfresh readしながら継続復旧。
- 正本で開始済みならドロー後盤面を採用し、古いowner/serialなら正本へ追従。
- 自端末tokenの再開、5秒経過した他端末claimのrecovery claim、状態別診断メッセージを追加。


## v173e

- Firestore Rules に `isSafeTurnStartAppliedUpdate()` を追加し、ターン開始ドロー・開始時効果の canonical 確定を一般 runtime 更新から分離しました。
- turnStartApplied は host / guest 共通で、現在の turnOwner 本人・同一 serial・同一 token・正しい appliedSerial のときだけ許可されます。
- 他人のターン、token 改竄、serial 飛ばし、二重 apply は拒否する方針を維持します。
- 既存 Emulator テストが guest の「claim」と「handoff」は確認していた一方、guest 自身の turnStartApplied 成功ケースを持っていなかったため、今回専用回帰ケースを追加しました。


## v173h

- オンライン対戦のFirestore更新経路を全体監査。
- 通常Action/handoff、降参・切断、postMatchから無関係なroom/member identity helper依存を除去。
- postMatchのmembers変更は `ready` だけをmap diffで検証。
- 通常勝敗のresult確定とpostMatchロビー移行を2段階に統一。
- プレイヤーカードの背景・称号変更はactiveRoomsロックから分離し、対戦ルーム参加中でも保存可能。現在ルームの表示は次回参加時から反映。
- `index.html` のキャッシュキーを `v173h` に更新。

## v173g
- turn-start claim/apply の Firestore Rules を、ロビー/メンバー/room metadata の共通 helper から完全に分離。
- claim は `match.turnStarted` / `match.turnStartToken` / `match.turnStartClaimedAt` と `updatedAt` 以外を変更できない専用遷移として認可。
- apply は `match.state` / `match.stateRevision` / `match.turnStartAppliedSerial` / `match.turnTimerStartedAt` と `updatedAt` だけを認可し、turn owner・serial・token・state lifecycle の一致を必須化。
- 実際に変更していない room/member フィールドの形に認可結果が左右されないようにした。
- `index.html` のキャッシュキーを `v173g` に更新。

## v173f
- ゲスト側のターン開始で `turnStarted / turnStartToken / turnStartClaimedAt` のclaim書き込み自体がFirestore Rulesに403拒否される問題を修正。
- turn-start claim/recoveryを一般runtime更新から分離し、host/guest対称の専用Rules経路 `isSafeTurnStartClaimUpdate()` を追加。
- claim時は盤面 `match.state` を完全不変、変更可能なmatch項目を3項目だけに限定。
- v173eのturnStartApplied専用経路と合わせて、ターン開始の claim → apply を両方専用Rulesで検証。

## v173i

- 過充電・光速回路・Furioso等でターン開始直後に行動不能となる場合、開始盤面を一度操作可能状態として公開せず、`turnStartApplied + handoff` を1回のcanonical更新にまとめる経路を追加。
- 即時終了処理中は入力ロックを維持し、過充電反動中の余分な盤面publishを削除。
- 通常handoff送信前に `turnOwner / turnSide / turnSerial` のローカルsnapshot整合性を検査し、食い違い時は送信せず再同期。
- 相手が手番を受け取った直後に開始せずheartbeatも止まった場合、45秒で切断救済可能にした（通常の開始済みターンは従来どおり3分）。
- 強制・貿易のtimeout時に対象カードが0枚ならsecure interactionをcleanupし、「対象なし」の不発へ収束。
- postMatchのreadyリセットをslot欠落/null対応にし、退出済みゲストがいてもホストがロビーへ戻せるよう修正。
- 降参ACK待ち中は結果画面の移動ボタンを無効化し、同期中表示を追加。
- `index.html` のキャッシュキーを `v173i` に更新。

## v173j

- v173i で誤って削除されていた `memberReadyOnlyChanged()` を Firestore Rules に復元。
- ロビーのホスト/ゲスト準備完了・準備解除で、本人側 member の `ready` だけを変更できる従来仕様を復旧。
- turn-start / handoff / postMatch / カード処理には変更なし。
- 準備完了 Rules の退行を検出する source regression test を追加。
- `index.html` のキャッシュキーを `v173j` に更新。
