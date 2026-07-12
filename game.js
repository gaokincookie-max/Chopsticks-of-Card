const CARD_LIBRARY = {
      insight: {
        name: "ひらめき",
        cost: 1,
        type: "補助",
        text: "カードを1枚引く。",
        canPlay: () => true,
        effect: (player) => {
          drawCard(player);
          addLog(`${handNames[player]}は「ひらめき」で1枚引いた。`);
        }
      },
      nekodamashi: {
        name: "ねこだまし",
        cost: 2,
        type: "補助",
        text: "カードを1枚引く。自分の初ターンが来る前に相手から攻撃を受けるとき、手札から捨ててその攻撃を無効化できる。乱射も無効化できる。",
        canPlay: () => true,
        effect: (player) => {
          drawCard(player);
          addLog(`${handNames[player]}は「ねこだまし」を使い、1枚引いた。`);
        }
      },
      strongHit: {
        name: "強打",
        cost: 2,
        type: "補助",
        text: "このターン、次の攻撃で攻撃する手の本数を+1して扱う。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].attackBonus += 1;
          addLog(`${handNames[player]}は「強打」を使った。次の攻撃+1。`);
        }
      },
      lightHit: {
        name: "軽打",
        cost: 1,
        type: "補助",
        text: "このターン、次の攻撃で攻撃する手の本数を-1して扱う。ただし攻撃力は1未満にならない。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].attackBonus -= 1;
          addLog(`${handNames[player]}は「軽打」を使った。次の攻撃-1。`);
        }
      },
      lockSplit: {
        name: "固定",
        cost: 2,
        type: "補助",
        text: "次の相手ターン、相手は「分ける」を選べない。",
        canPlay: () => true,
        effect: (player) => {
          const opponent = player === "human" ? "cpu" : "human";
          state.noSplit[opponent] = true;
          addLog(`${handNames[player]}は「固定」を使った。次の${handNames[opponent]}のターン、分けるを封じる。`);
        }
      },
      repair: {
        name: "補修",
        cost: 3,
        type: "終端",
        text: "手札を1枚捨て、自分の0の手を1にする。このカードを使ったら、ターンを終了する。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] === 0) && state.hands[player].length > 1,
        terminal: true,
        effect: async (player) => {
          const zeroHands = ["L", "R"].filter(h => state[player][h] === 0);
          if (zeroHands.length === 0) return;

          if (player === "human") {
            state.mode = "repairDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「補修」：捨てる手札を1枚選んでください。補修後、ターンは終了します。");
            return;
          }

          const hand = zeroHands[0];
          const discardIndex = chooseCpuDiscardIndex();
          if (discardIndex < 0) return;
          const [discarded] = state.hands[player].splice(discardIndex, 1);
          state.discard[player].push(discarded);
          await handleCardDiscardEffect(player, discarded);
          state[player][hand] = 1;
          addLog(`${handNames[player]}は「補修」で「${CARD_LIBRARY[discarded].name}」を捨て、${handNames[hand]}を0→1に戻した。ターン終了。`);
          state.pendingTerminalEnd[player] = true;
        }
      },

      doubleDouble: {
        name: "ダブルダブル",
        cost: 3,
        type: "補助",
        text: "自分の両手がどちらも2のときに使える。このターン、攻撃か分けるを追加で1回行える。",
        canPlay: (player) => state[player].L === 2 && state[player].R === 2,
        effect: (player) => {
          state.extraActions[player] += 1;
          addLog(`${handNames[player]}は「ダブルダブル」を使った。このターン、行動を追加で1回行える。`);
        }
      },
      acceleration: {
        name: "過加速",
        cost: 3,
        type: "補助",
        text: "次の自分のターンから2ターンの間、ターン開始時に追加で1枚引く。その後2ターンの間、ターン開始時にカードを引けない。",
        canPlay: () => true,
        effect: (player) => {
          state.pendingAcceleration[player] += 2;
          state.pendingNoDraw[player] += 2;
          addLog(`${handNames[player]}は「過加速」を使った。次の自分のターンから2ターン追加で1枚引き、その後2ターンはドローできない。`);
        }
      },

      randomDice: {
        name: "ランダムダイス",
        cost: 1,
        type: "補助",
        text: "自分の0でない手を1つ選ぶ。その手の本数を0〜4のランダムな本数に変更する。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] > 0),
        effect: async (player) => {
          if (player === "human") {
            state.mode = "randomDice";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「ランダムダイス」：本数を変える自分の0でない手を選んでください。");
            return;
          }
          const choices = ["L", "R"].filter(h => state[player][h] > 0);
          const hand = choices[Math.floor(Math.random() * choices.length)];
          await applyRandomDice(player, hand);
        }
      },
      equalTrade: {
        name: "等価交換",
        cost: 2,
        type: "補助",
        text: "自分の0でない手を1つ選び、その手を-1する。その後、相手の2以上の手を1つ選び、その手を-1する。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] > 0) && ["L", "R"].some(h => state[player === "human" ? "cpu" : "human"][h] >= 2),
        effect: (player) => {
          if (player === "human") {
            state.mode = "equalTradeSelf";
            state.pendingEqualTradeSelf = null;
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「等価交換」：まず-1する自分の手を選んでください。");
            return;
          }
          applyCpuEqualTrade();
        }
      },

      battlePrep: {
        name: "戦闘準備",
        cost: 1,
        type: "補助",
        text: "山札からランダムな罠カードを1枚手札に加える。罠カードが山札にない場合、何も起きない。",
        canPlay: () => true,
        effect: (player) => {
          const trapIndexes = [];
          state.decks[player].forEach((cardId, index) => {
            if (CARD_LIBRARY[cardId]?.trap) trapIndexes.push(index);
          });
          if (trapIndexes.length === 0) {
            addLog(`${handNames[player]}は「戦闘準備」を使ったが、山札に罠カードがなかった。`);
            return;
          }
          const deckIndex = trapIndexes[Math.floor(Math.random() * trapIndexes.length)];
          const [cardId] = state.decks[player].splice(deckIndex, 1);
          state.hands[player].push(cardId);
          addLog(`${handNames[player]}は「戦闘準備」で罠カード「${CARD_LIBRARY[cardId].name}」を手札に加えた。`);
        }
      },
      snipe: {
        name: "狙撃",
        cost: 2,
        type: "補助",
        text: "相手の0でない手を1つ選び、その手に1本加える。",
        canPlay: (player) => ["L", "R"].some(h => state[player === "human" ? "cpu" : "human"][h] > 0),
        effect: (player) => {
          if (player === "human") {
            state.mode = "snipe";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「狙撃」：+1する相手の手を選んでください。");
            return;
          }
          const target = chooseCpuSnipeTarget();
          if (target) applySnipe(player, "human", target);
        }
      },
      rapidFire: {
        name: "乱射",
        cost: 2,
        type: "終端",
        text: "手札を1枚捨て、捨てた手札のコスト分のダメージを相手の手に与える。捨てたカードが「弾」ならダメージ+1。この攻撃には一部の罠を発動できる。使用後、ターン終了。",
        canPlay: (player) => state.hands[player].length > 1 && ["L", "R"].some(h => state[player === "human" ? "cpu" : "human"][h] > 0),
        terminal: true,
        effect: async (player) => {
          if (player === "human") {
            state.mode = "rapidFireDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「乱射」：弾薬として捨てる手札を1枚選んでください。");
            return;
          }
          const discardIndex = chooseCpuRapidFireDiscardIndex();
          if (discardIndex < 0) {
            state.pendingTerminalEnd[player] = true;
            return;
          }
          const opponent = "human";
          const target = chooseCpuSnipeTarget();
          if (target) {
            await applyRapidFire(player, opponent, discardIndex, target);
          } else {
            state.pendingTerminalEnd[player] = true;
          }
        }
      },
      accelBullet: {
        name: "加速弾",
        cost: 1,
        type: "補助",
        text: "このカードは「弾」として扱う。使用しても何も起きない。このカードがカードの効果で手札から捨てられたとき、カードを1枚引く。",
        bullet: true,
        canPlay: () => true,
        effect: (player) => {
          addLog(`${handNames[player]}は「加速弾」を使った。何も起きなかった。`);
        }
      },
      specialBullet: {
        name: "特殊弾",
        cost: 2,
        type: "補助",
        text: "このカードは「弾」として扱う。使用しても何も起きない。このカードがカードの効果で手札から捨てられたとき、相手の手札をランダムに1枚捨てさせる。",
        bullet: true,
        canPlay: () => true,
        effect: (player) => {
          addLog(`${handNames[player]}は「特殊弾」を使った。何も起きなかった。`);
        }
      },
      pierceBullet: {
        name: "貫通弾",
        cost: 3,
        type: "補助",
        text: "このカードは「弾」として扱う。使用しても何も起きない。このカードがカードの効果で手札から捨てられたとき、相手の設置された罠カードをランダムに1枚捨てる。",
        bullet: true,
        canPlay: () => true,
        effect: (player) => {
          addLog(`${handNames[player]}は「貫通弾」を使った。何も起きなかった。`);
        }
      },

      bulletSupply: {
        name: "弾丸補給",
        cost: 1,
        type: "補助",
        text: "山札から「弾」として扱うカードをランダムに1枚手札に加える。山札に弾カードがない場合、何も起きない。",
        canPlay: () => true,
        effect: (player) => {
          const bulletIndexes = [];
          state.decks[player].forEach((cardId, index) => {
            if (CARD_LIBRARY[cardId]?.bullet) bulletIndexes.push(index);
          });
          if (bulletIndexes.length === 0) {
            addLog(`${handNames[player]}は「弾丸補給」を使ったが、山札に弾カードがなかった。`);
            return;
          }
          const deckIndex = bulletIndexes[Math.floor(Math.random() * bulletIndexes.length)];
          const [cardId] = state.decks[player].splice(deckIndex, 1);
          state.hands[player].push(cardId);
          addLog(`${handNames[player]}は「弾丸補給」で「${CARD_LIBRARY[cardId].name}」を手札に加えた。`);
        }
      },
      reload: {
        name: "再装填",
        cost: 2,
        type: "補助",
        text: "自分の捨て札にある「乱射」をランダムに1枚手札に戻す。捨て札に「乱射」がない場合、何も起きない。",
        canPlay: () => true,
        effect: (player) => {
          const indexes = [];
          state.discard[player].forEach((cardId, index) => {
            if (cardId === "rapidFire") indexes.push(index);
          });
          if (indexes.length === 0) {
            addLog(`${handNames[player]}は「再装填」を使ったが、捨て札に乱射がなかった。`);
            return;
          }
          const picked = indexes[Math.floor(Math.random() * indexes.length)];
          const [cardId] = state.discard[player].splice(picked, 1);
          state.hands[player].push(cardId);
          addLog(`${handNames[player]}は「再装填」で「乱射」を手札に戻した。`);
        }
      },
      focusedShot: {
        name: "一点狙い",
        cost: 3,
        type: "終端",
        text: "手札に「ロジックアトリエ」を1枚加える。このカードを使ったら、ターンを終了する。",
        canPlay: () => true,
        terminal: true,
        effect: (player) => {
          state.hands[player].push("logicCrusherBullet");
          state.pendingTerminalEnd[player] = true;
          addLog(`${handNames[player]}は「一点狙い」で「ロジックアトリエ」を手札に加えた。ターン終了。`);
        }
      },
      logicCrusherBullet: {
        name: "ロジックアトリエ",
        cost: 0,
        type: "使用不可 / 弾",
        text: "このカードはデッキに入れられず、使用できない。このカードは「弾」として扱う。「乱射」の効果でこのカードが捨てられた場合、ダメージを与える代わりに、指定した相手の手を0にする。この攻撃に対して相手は罠を発動できない。",
        bullet: true,
        token: true,
        canPlay: () => false,
        effect: () => {}
      },

      calm: {
        name: "整える",
        cost: 1,
        type: "補助",
        text: "自分の選んだ手からもう片方へ1本移す。通常の分けると違い、片手が0になってもよい。",
        canPlay: (player) => getMoveOneOptions(player).length > 0,
        effect: (player) => {
          const options = getMoveOneOptions(player);
          if (options.length === 0) return;

          if (player === "human") {
            state.mode = "moveOne";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            setMessage("「整える」：1本移したい元の手を選んでください。");
            return;
          }

          const opt = options[Math.floor(Math.random() * options.length)];
          state[player].L = opt.L;
          state[player].R = opt.R;
          addLog(`${handNames[player]}は「整える」を使った。${opt.label}`);
          clearBrokenTraps(player);
        }
      },
      scout: {
        name: "探り",
        cost: 1,
        type: "補助",
        text: "相手の手札枚数を確認する。",
        canPlay: () => true,
        effect: (player) => {
          const opponent = player === "human" ? "cpu" : "human";
          addLog(`${handNames[player]}は「探り」を使った。${handNames[opponent]}の手札は${state.hands[opponent].length}枚。`);
        }
      },
      guard: {
        name: "身構え",
        cost: 2,
        type: "補助",
        text: "このターン終了まで、自分の手が0になるとき一度だけ4で止まる。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].guard = true;
          addLog(`${handNames[player]}は「身構え」を使った。`);
        }
      },

      removeTrap: {
        name: "解除",
        cost: 2,
        type: "補助",
        text: "相手の伏せカードを1枚選び、捨て札に置く。",
        canPlay: (player) => hasOpponentTrap(player),
        effect: (player) => {
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "remove";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
            setMessage("「解除」：捨て札に置く相手の伏せカードをタップしてください。");
            return;
          }
          const target = chooseCpuOpponentTrap("human");
          if (target) removeOpponentTrap(player, target.owner, target.hand, target.index);
        }
      },
      revealTrap: {
        name: "看破",
        cost: 1,
        type: "補助",
        text: "相手の伏せカードを1枚選んで確認する。確認したカードは伏せたままにする。",
        canPlay: (player) => hasOpponentTrap(player),
        effect: (player) => {
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "reveal";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
            setMessage("「看破」：確認する相手の伏せカードをタップしてください。");
            return;
          }
          const target = chooseCpuOpponentTrap("human");
          if (target) revealOpponentTrap(player, target.owner, target.hand, target.index);
        }
      },
      pullTrap: {
        name: "手繰り寄せ",
        cost: 2,
        type: "補助",
        text: "相手の罠ゾーンにあるカード1枚を選び、相手のもう片方の手の空き枠へ移動する。罠・加護・呪縛を移動できる。",
        canPlay: (player) => hasMovableOpponentTrap(player),
        effect: (player) => {
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "move";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
            setMessage("「手繰り寄せ」：移動させる相手のカードをタップしてください。");
            return;
          }
          const target = chooseCpuMovableOpponentTrap("human");
          if (target) moveOpponentTrap(player, target.owner, target.hand, target.index);
        }
      },
      swapAttachment: {
        name: "すりかえ",
        cost: 2,
        type: "補助",
        text: "相手の罠ゾーンにある加護・呪縛を1枚選び、自分の罠ゾーンにある加護・呪縛を1枚選ぶ。その2枚を交換する。",
        canPlay: (player) => hasSwapTargets(player),
        effect: (player) => {
          if (player === "human") {
            state.mode = "swapOpponentAttachment";
            state.pendingSwapFirst = null;
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
            setMessage("「すりかえ」：まず相手の加護・呪縛をタップしてください。");
            render();
            return;
          }
          const pair = chooseCpuSwapPair(player);
          if (pair) swapAttachments(player, pair.opponent, pair.own);
        }
      },
      breakthrough: {
        name: "強行突破",
        cost: 3,
        type: "補助",
        text: "このターン、自分の攻撃は相手側の罠・加護・呪縛の効果を受けない。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].breakthrough = true;
          addLog(`${handNames[player]}は「強行突破」を使った。このターン、自分の攻撃は相手側の罠・加護・呪縛を無視する。`);
        }
      },

      setupTrap: {
        name: "仕込み",
        cost: 3,
        type: "終端",
        text: "このターン、罠カードに限りカード関連行動の回数制限を無視して好きなだけ伏せてもよい。攻撃も分けるもできず、仕込み終了で相手にターンを渡す。",
        canPlay: (player) => canSetAnyTrap(player) && state.hands[player].some(id => CARD_LIBRARY[id]?.trap),
        effect: (player) => {
          state.temp[player].setupMode = true;
          state.mode = "setupTrap";
          state.selectedAttackHand = null;
          state.selectedTrapCardIndex = null;
          state.pendingTrapTargetEffect = null;
          elements.splitBox.classList.remove("active");
          addLog(`${handNames[player]}は「仕込み」を使った。罠を好きなだけ伏せられる。`);
          if (player === "human") {
            setMessage("「仕込み」：このターンは罠カードを好きなだけ伏せられます。終わったら「仕込み終了」を押してください。");
          }
        }
      },

      passCard: {
        name: "パス",
        cost: 0,
        type: "終端",
        text: "このカードを使ったら、ターンを終了する。",
        canPlay: () => true,
        terminal: true,
        effect: (player) => {
          addLog(`${handNames[player]}は「パス」を使った。ターン終了。`);
          state.pendingTerminalEnd[player] = true;
        }
      },
      cursedBullet: {
        name: "凶弾",
        cost: 3,
        type: "終端",
        text: "自分の両手が1以上のときに使える。選んだ自分の手で、選ばなかった自分の手を攻撃する。この攻撃で攻撃された手がちょうど5になった場合、相手の1以上の手に3本ずつ加える。この攻撃では対象変更できない。",
        canPlay: (player) => state[player].L > 0 && state[player].R > 0,
        terminal: true,
        effect: async (player) => {
          if (player === "human") {
            state.mode = "cursedBullet";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「凶弾」：攻撃に使う自分の手を選んでください。選ばなかった手を攻撃します。");
            return;
          }
          const choices = ["L", "R"].filter(h => state[player][h] > 0);
          choices.sort((a, b) => state[player][b] - state[player][a]);
          await applyCursedBullet(player, choices[0]);
        }
      },

      thriftLaw: {
        name: "倹約令",
        cost: 3,
        type: "補助",
        text: "次の相手ターン、相手はコスト2以下のカードしか使用できない。罠の発動はこの制限を受けない。",
        canPlay: () => true,
        effect: (player) => {
          const opponent = player === "human" ? "cpu" : "human";
          state.costLimitNextTurn[opponent] = 2;
          addLog(`${handNames[player]}は「倹約令」を使った。次の${handNames[opponent]}のターン、コスト2以下のカードしか使えない。`);
        }
      },
      berserker: {
        name: "バーサーカー",
        cost: 3,
        type: "補助",
        text: "このターンと次の自分のターン、自分はカード使用・罠設置・分けるができない。その間、自分の攻撃力を+2する。",
        canPlay: () => true,
        effect: (player) => {
          state.berserkerTurns[player] = Math.max(state.berserkerTurns[player], 2);
          state.temp[player].berserkerJustUsed = true;
          addLog(`${handNames[player]}は「バーサーカー」を使った。2ターンの間、攻撃+2、分けるとカード使用不可。`);
        }
      },
      calmDown: {
        name: "落ち着ける",
        cost: 1,
        type: "補助",
        text: "手札を1枚選んで捨てる。その後、カードを2枚引く。",
        canPlay: (player) => state.hands[player].length > 1,
        effect: async (player) => {
          if (player === "human") {
            state.mode = "calmDownDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
            setMessage("「落ち着ける」：捨てる手札を1枚選んでください。その後2枚引きます。");
            return;
          }
          const discardIndex = chooseCpuDiscardIndex();
          if (discardIndex < 0) return;
          const [discarded] = state.hands[player].splice(discardIndex, 1);
          state.discard[player].push(discarded);
          await handleCardDiscardEffect(player, discarded);
          drawCard(player);
          drawCard(player);
          addLog(`${handNames[player]}は「落ち着ける」で「${CARD_LIBRARY[discarded].name}」を捨て、2枚引いた。`);
        }
      },

      deflect: {
        name: "受け流し",
        cost: 2,
        type: "罠",
        text: "【攻撃判定前・手動】この手が攻撃対象になったとき、攻撃対象をもう片方の手に変更する。",
        trap: true,
        manual: true,
        triggerTiming: "before",
        canTrigger: ({ defender, placedHand, targetHand }) => {
          const other = otherHand(placedHand);
          return placedHand === targetHand && state[defender][other] > 0;
        },
        trigger: ({ defender, placedHand }) => {
          const other = otherHand(placedHand);
          addLog(`${handNames[defender]}の罠「受け流し」発動。攻撃対象を${handNames[other]}に変更。`);
          return { targetHand: other };
        }
      },
      attention: {
        name: "注目",
        cost: 2,
        type: "罠",
        text: "【攻撃判定前・手動】相手が攻撃するとき、攻撃対象をこの手に変更する。",
        trap: true,
        manual: true,
        triggerTiming: "before",
        canTrigger: ({ defender, placedHand, targetHand }) => {
          return placedHand !== targetHand && state[defender][placedHand] > 0;
        },
        trigger: ({ defender, placedHand }) => {
          addLog(`${handNames[defender]}の罠「注目」発動。攻撃対象を${handNames[placedHand]}に変更。`);
          return { targetHand: placedHand };
        }
      },
      braceTrap: {
        name: "踏み止まり",
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・手動】この手が攻撃で0になるとき、0にならず4で止まる。",
        trap: true,
        manual: true,
        triggerTiming: "after",
        canTrigger: ({ defender, placedHand, targetHand, incomingPower, resolvedFinal }) => {
          const result = typeof resolvedFinal === "number" ? resolvedFinal : wrapFinger(state[defender][targetHand] + incomingPower);
          return placedHand === targetHand && result === 0;
        },
        trigger: ({ defender, placedHand }) => {
          addLog(`${handNames[defender]}の罠「踏み止まり」発動。${handNames[placedHand]}は4で止まる。`);
          return { stopAtFour: true };
        }
      },
      dodgeTrap: {
        name: "空振り",
        cost: 4,
        type: "罠",
        text: "【攻撃判定前・手動】この手が攻撃対象になったとき、その攻撃を無効にする。",
        trap: true,
        manual: true,
        triggerTiming: "before",
        canTrigger: ({ placedHand, targetHand }) => placedHand === targetHand,
        trigger: ({ defender }) => {
          addLog(`${handNames[defender]}の罠「空振り」発動。攻撃を無効化。`);
          return { cancelAttack: true };
        }
      },
      puddleTrap: {
        name: "ぬかるみ",
        cost: 2,
        type: "罠",
        text: "【攻撃判定前・自動】この手が攻撃対象になったとき、その攻撃の攻撃力を-1する。ただし攻撃力は1未満にならない。",
        trap: true,
        manual: false,
        triggerTiming: "before",
        canTrigger: ({ placedHand, targetHand, incomingPower }) => {
          return placedHand === targetHand && incomingPower > 1;
        },
        trigger: () => {
          addLog("罠「ぬかるみ」により、攻撃力が-1された。");
          return { powerDelta: -1 };
        }
      },
      partingGift: {
        name: "置き土産",
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・自動】この手が攻撃で0になったとき、攻撃した相手は手札を1枚捨てる。",
        trap: true,
        manual: false,
        triggerTiming: "after",
        canTrigger: ({ placedHand, targetHand, resolvedFinal, attacker }) => {
          return placedHand === targetHand && resolvedFinal === 0 && state.hands[attacker].length > 0;
        },
        trigger: ({ attacker }) => {
          discardOneCard(attacker);
          addLog(`罠「置き土産」により、${handNames[attacker]}は手札を1枚捨てた。`);
          return {};
        }
      },
      thornTrap: {
        name: "茨",
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・自動】この手が攻撃された後、攻撃してきた相手の手に1本加える。この手が0になっても発動する。",
        trap: true,
        manual: false,
        triggerTiming: "after",
        canTrigger: ({ placedHand, targetHand, attacker, attackHand }) => {
          return placedHand === targetHand && state[attacker][attackHand] > 0;
        },
        trigger: async ({ attacker, attackHand }) => {
          const before = state[attacker][attackHand];
          const amount = applyGuardBlessingReduction(attacker, attackHand, 1, "茨");
          const total = before + amount;
          const finalValue = normalize(total, attacker, attackHand);
          await animateCalculation(attacker, attackHand, total, finalValue);
          state[attacker][attackHand] = finalValue;
          addLog(`罠「茨」により、${handNames[attacker]}の${handNames[attackHand]}が${before}→${total}${total >= 5 ? `→${finalValue}` : ""}。`);
          return {};
        }
      },
      counterTrap: {
        name: "反撃",
        cost: 3,
        type: "罠",
        text: "【攻撃判定後・手動】この手が攻撃された後、この手が0でなければ発動できる。攻撃してきた相手の手に、この手の本数を加える。",
        trap: true,
        manual: true,
        triggerTiming: "after",
        canTrigger: ({ defender, placedHand, targetHand, attacker, attackHand }) => {
          return placedHand === targetHand && state[defender][placedHand] > 0 && state[attacker][attackHand] > 0;
        },
        trigger: async ({ defender, placedHand, attacker, attackHand }) => {
          const rawPower = state[defender][placedHand];
          const before = state[attacker][attackHand];
          const power = applyGuardBlessingReduction(attacker, attackHand, rawPower, "反撃");
          const total = before + power;
          const finalValue = normalize(total, attacker, attackHand);
          await animateCalculation(attacker, attackHand, total, finalValue);
          state[attacker][attackHand] = finalValue;
          addLog(`罠「反撃」により、${handNames[attacker]}の${handNames[attackHand]}が${before}→${total}${total >= 5 ? `→${finalValue}` : ""}。`);
          return {};
        }
      },
      swampMan: {
        name: "スワンプマン",
        cost: 3,
        type: "罠",
        text: "【攻撃判定後・手動】この手が攻撃された後、攻撃計算後のこの手が0でなければ発動できる。この手と、攻撃してきた相手の手の本数を入れ替える。",
        trap: true,
        manual: true,
        triggerTiming: "after",
        canTrigger: ({ defender, placedHand, targetHand, attacker, attackHand, resolvedFinal }) => {
          return placedHand === targetHand && resolvedFinal !== 0 && state[attacker][attackHand] > 0;
        },
        trigger: ({ defender, placedHand, attacker, attackHand }) => {
          const a = state[defender][placedHand];
          const b = state[attacker][attackHand];
          state[defender][placedHand] = b;
          state[attacker][attackHand] = a;
          addLog(`罠「スワンプマン」発動。${handNames[defender]}の${handNames[placedHand]}と${handNames[attacker]}の${handNames[attackHand]}を入れ替えた。`);
          return {};
        }
      },
      baitTrap: {
        name: "囮",
        cost: 1,
        type: "罠",
        text: "【攻撃判定後・自動】この手が攻撃対象になったとき、カードを1枚引く。",
        trap: true,
        manual: false,
        triggerTiming: "after",
        canTrigger: ({ placedHand, targetHand }) => placedHand === targetHand,
        trigger: ({ defender }) => {
          drawCard(defender);
          addLog(`${handNames[defender]}の罠「囮」発動。1枚引いた。`);
          return {};
        }
      },
      escapeDevice: {
        name: "逃走装置",
        cost: 2,
        type: "罠",
        text: "【攻撃判定前・手動】自分が片手だけの状態で、この手が攻撃対象になったとき発動できる。この手の本数を反対側の0の手へ移し、この攻撃を無効化する。",
        trap: true,
        manual: true,
        triggerTiming: "before",
        canTrigger: ({ defender, placedHand, targetHand }) => {
          const other = otherHand(placedHand);
          return placedHand === targetHand && state[defender][placedHand] > 0 && state[defender][other] === 0;
        },
        trigger: ({ defender, placedHand }) => {
          const other = otherHand(placedHand);
          const value = state[defender][placedHand];
          state[defender][placedHand] = 0;
          state[defender][other] = value;
          addLog(`${handNames[defender]}の罠「逃走装置」発動。${handNames[placedHand]}の${value}本を${handNames[other]}へ移し、攻撃を無効化。`);
          clearBrokenTraps(defender);
          return { cancelAttack: true };
        }
      },
      magicMirror: {
        name: "マジックミラー",
        cost: 2,
        type: "罠",
        text: "【呪縛設置時・手動】相手がこの手に呪縛を設置しようとしたとき発動できる。その呪縛を相手の1以上で空き枠のある手に表向きで設置する。設置先がなければ呪縛は捨て札になる。",
        trap: true,
        manual: true,
        triggerTiming: "curse"
      },
      prayer: {
        name: "祈祷",
        cost: 1,
        type: "補助",
        text: "山札から「加護」または「呪縛」をランダムに1枚手札に加える。山札に加護も呪縛もない場合、何も起きない。",
        canPlay: () => true,
        effect: (player) => {
          const options = [];
          state.decks[player].forEach((cardId, index) => {
            const card = CARD_LIBRARY[cardId];
            if (card?.blessing || card?.curse) options.push({ cardId, index });
          });
          if (options.length === 0) {
            addLog(`${handNames[player]}は「祈祷」を使ったが、山札に加護・呪縛はなかった。`);
            return;
          }
          const picked = options[Math.floor(Math.random() * options.length)];
          const [cardId] = state.decks[player].splice(picked.index, 1);
          state.hands[player].push(cardId);
          addLog(`${handNames[player]}は「祈祷」で山札から「${CARD_LIBRARY[cardId].name}」を手札に加えた。`);
        }
      },
      dispelCurse: {
        name: "解呪",
        cost: 2,
        type: "補助",
        text: "自分の手に置かれている呪縛を1枚選び、捨て札に置く。",
        canPlay: (player) => hasOwnCurse(player),
        effect: (player) => {
          if (player === "human") {
            state.mode = "chooseOwnCurse";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = "dispel";
            elements.splitBox.classList.remove("active");
            setMessage("「解呪」：捨て札にする自分の呪縛をタップしてください。");
            render();
            return;
          }
          const target = chooseCpuOwnCurse(player);
          if (target) removeOwnCurse(player, target.hand, target.index);
        }
      },
      powerBlessing: {
        name: "力の加護",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手で攻撃するとき、攻撃力+1。手が0になったら捨て札に置く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      guardBlessing: {
        name: "守護",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手が攻撃・狙撃・反撃などで本数を加えられるとき、その本数-1。ただし最低1。手が0になったら捨て札に置く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      growthBlessing: {
        name: "成長",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手で攻撃し、相手の手の合計がちょうど5になったとき、カードを1枚引く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      recklessBlessing: {
        name: "捨て身",
        cost: 3,
        type: "加護",
        text: "自分の手に表向きで置く。この手で攻撃するとき攻撃力+2。相手を攻撃した後、この手に1本加える。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      ricochetBlessing: {
        name: "跳弾",
        cost: 3,
        type: "加護",
        text: "自分の手に表向きで置く。この手で攻撃した後、相手のもう片方の手にこの手の本数の半分、切り捨ての本数を加える。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      slowCurse: {
        name: "鈍重の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手で攻撃するとき、攻撃力-1。ただし最低1。手が0になったら捨て札に置く。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      exposeCurse: {
        name: "露呈の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手に置かれる罠は表向きになる。手が0になったら捨て札に置く。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      weaknessCurse: {
        name: "衰弱の呪縛",
        cost: 3,
        type: "呪縛",
        text: "相手の手に表向きで置く。置かれた後、持ち主のターン終了を1回待機する。その次からターン終了時にその手の本数を-1する。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      overflowCurse: {
        name: "超過の呪縛",
        cost: 3,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手は5以上になったら、余り計算をせず0になる。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      immutableCurse: {
        name: "不変の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手は攻撃力を増やす効果を受けない。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      sealCurse: {
        name: "封印の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手には新たに加護を置けない。すでに置かれている加護は残る。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      }
    };

        const DECK_MIN_COUNT = 6;
    const DECK_MAX_COUNT = 20;

    const DEFAULT_DECK_COUNTS = {
      insight: 1,
      nekodamashi: 1,
      swapAttachment: 1,
      snipe: 1,
      rapidFire: 1,
      prayer: 1,
      dispelCurse: 1,
      escapeDevice: 1,
      magicMirror: 1,
      powerBlessing: 1,
      guardBlessing: 1,
      growthBlessing: 1,
      recklessBlessing: 1,
      ricochetBlessing: 1,
      slowCurse: 1,
      weaknessCurse: 1,
      overflowCurse: 1,
      immutableCurse: 1,
      sealCurse: 1,
      passCard: 1,
    };

    const state = {
      human: { L: 1, R: 1 },
      cpu: { L: 1, R: 1 },
      traps: {
        human: { L: [], R: [] },
        cpu: { L: [], R: [] }
      },
      decks: { human: [], cpu: [] },
      hands: { human: [], cpu: [] },
      discard: { human: [], cpu: [] },
      temp: {
        human: { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false },
        cpu: { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false }
      },
      deckCounts: { human: { ...DEFAULT_DECK_COUNTS }, cpu: { ...DEFAULT_DECK_COUNTS } },
      editingDeckOwner: "human",
      cpuDifficulty: "standard",
      costLimit: 40,
      selectedTrapCardIndex: null,
      pendingTrapTargetEffect: null,
      pendingRepairDiscard: null,
      revealedTrapIds: new Set(),
      noSplit: { human: false, cpu: false },
      extraActions: { human: 0, cpu: 0 },
      pendingAcceleration: { human: 0, cpu: 0 },
      activeAcceleration: { human: 0, cpu: 0 },
      pendingTerminalEnd: { human: false, cpu: false },
      costLimitNextTurn: { human: null, cpu: null },
      activeCostLimit: { human: null, cpu: null },
      berserkerTurns: { human: 0, cpu: 0 },
      pendingEqualTradeSelf: null,
      pendingRapidFireDiscard: null,
      pendingSwapFirst: null,
      firstTurnStarted: { human: false, cpu: false },
      weaknessWait: {},
      lastAction: null,
      turn: "human",
      mode: "attack",
      selectedAttackHand: null,
      animating: false,
      gameOver: false,
      log: [],
      turnNumber: 0,
      currentScreen: "modeMenu",
      battleMode: "cpu",
      friendRoomId: null,
      friendRoomUrl: null,
      friendRole: null,
      friendReady: false,
      friendUnsubscribe: null,
      friendPollTimer: null,
      friendRoomData: null,
      friendSelectedOwnHand: "L",
      friendSelectedTargetHand: "L",
      friendLastHandValues: null,
      friendPendingRapidFire: null,
      friendPendingDiscardAction: null,
      friendPendingTapAction: null,
      friendLastFxId: null,
      onlineDeckCounts: null
    };

    const handNames = {
      L: "左手",
      R: "右手",
      human: "あなた",
      cpu: "CPU"
    };

    const elements = {
      message: document.getElementById("message"),
      deckEditorMessage: document.getElementById("deckEditorMessage"),
      log: document.getElementById("log"),
      modeMenuScreen: document.getElementById("modeMenuScreen"),
      onlineMenuScreen: document.getElementById("onlineMenuScreen"),
      onlineDeckScreen: document.getElementById("onlineDeckScreen"),
      offlineModeBtn: document.getElementById("offlineModeBtn"),
      onlineModeBtn: document.getElementById("onlineModeBtn"),
      offlineBackModeBtn: document.getElementById("offlineBackModeBtn"),
      onlineStartBtn: document.getElementById("onlineStartBtn"),
      onlineDeckBtn: document.getElementById("onlineDeckBtn"),
      onlineBackModeBtn: document.getElementById("onlineBackModeBtn"),
      onlineDeckList: document.getElementById("onlineDeckList"),
      onlineDeckSummary: document.getElementById("onlineDeckSummary"),
      onlineDeckMessage: document.getElementById("onlineDeckMessage"),
      onlineDeckCodeBox: document.getElementById("onlineDeckCodeBox"),
      onlineDeckCodeMessage: document.getElementById("onlineDeckCodeMessage"),
      onlineDeckExportBtn: document.getElementById("onlineDeckExportBtn"),
      onlineDeckImportBtn: document.getElementById("onlineDeckImportBtn"),
      onlineDeckCopyBtn: document.getElementById("onlineDeckCopyBtn"),
      onlineDeckSlotSelect: document.getElementById("onlineDeckSlotSelect"),
      onlineDeckSaveSlotBtn: document.getElementById("onlineDeckSaveSlotBtn"),
      onlineDeckLoadSlotBtn: document.getElementById("onlineDeckLoadSlotBtn"),
      onlineDeckDefaultBtn: document.getElementById("onlineDeckDefaultBtn"),
      onlineDeckBackBtn: document.getElementById("onlineDeckBackBtn"),
      menuScreen: document.getElementById("menuScreen"),
      battleSelectScreen: document.getElementById("battleSelectScreen"),
      friendLobbyScreen: document.getElementById("friendLobbyScreen"),
      difficultyScreen: document.getElementById("difficultyScreen"),
      settingsScreen: document.getElementById("settingsScreen"),
      deckEditorScreen: document.getElementById("deckEditorScreen"),
      menuStartBtn: document.getElementById("menuStartBtn"),
      menuDeckBtn: document.getElementById("menuDeckBtn"),
      menuSettingsBtn: document.getElementById("menuSettingsBtn"),
      plVsCpuBtn: document.getElementById("plVsCpuBtn"),
      plVsPlBtn: document.getElementById("plVsPlBtn"),
      battleSelectBackBtn: document.getElementById("battleSelectBackBtn"),
      createRoomBtn: document.getElementById("createRoomBtn"),
      copyRoomUrlBtn: document.getElementById("copyRoomUrlBtn"),
      roomUrlText: document.getElementById("roomUrlText"),
      roomIdInput: document.getElementById("roomIdInput"),
      joinRoomBtn: document.getElementById("joinRoomBtn"),
      friendLobbyMessage: document.getElementById("friendLobbyMessage"),
      roomStatusText: document.getElementById("roomStatusText"),
      roomPlayersText: document.getElementById("roomPlayersText"),
      friendReadyBtn: document.getElementById("friendReadyBtn"),
      friendUnreadyBtn: document.getElementById("friendUnreadyBtn"),
      friendReadyText: document.getElementById("friendReadyText"),
      friendGamePanel: document.getElementById("friendGamePanel"),
      friendGameStatus: document.getElementById("friendGameStatus"),
      friendStartGameBtn: document.getElementById("friendStartGameBtn"),
      friendBattleScreen: document.getElementById("friendBattleScreen"),
      friendBattleStatus: document.getElementById("friendBattleStatus"),
      friendYourRoleText: document.getElementById("friendYourRoleText"),
      friendTurnText: document.getElementById("friendTurnText"),
      friendSelectHint: document.getElementById("friendSelectHint"),
      friendHostHands: document.getElementById("friendHostHands"),
      friendGuestHands: document.getElementById("friendGuestHands"),
      friendHostLeft: document.getElementById("friendHostLeft"),
      friendHostRight: document.getElementById("friendHostRight"),
      friendGuestLeft: document.getElementById("friendGuestLeft"),
      friendGuestRight: document.getElementById("friendGuestRight"),
      friendHostDeckInfo: document.getElementById("friendHostDeckInfo"),
      friendGuestDeckInfo: document.getElementById("friendGuestDeckInfo"),
      friendOpponentDeckInfo: document.getElementById("friendOpponentDeckInfo"),
      friendOwnDeckInfo: document.getElementById("friendOwnDeckInfo"),
      friendOpponentLeft: document.getElementById("friendOpponentLeft"),
      friendOpponentRight: document.getElementById("friendOpponentRight"),
      friendOwnLeft: document.getElementById("friendOwnLeft"),
      friendOwnRight: document.getElementById("friendOwnRight"),
      friendOpponentLeftAttach: document.getElementById("friendOpponentLeftAttach"),
      friendOpponentRightAttach: document.getElementById("friendOpponentRightAttach"),
      friendOwnLeftAttach: document.getElementById("friendOwnLeftAttach"),
      friendOwnRightAttach: document.getElementById("friendOwnRightAttach"),
      friendHandCards: document.getElementById("friendHandCards"),
      friendCardBurst: document.getElementById("friendCardBurst"),
      friendAttackFrom: document.getElementById("friendAttackFrom"),
      friendAttackTo: document.getElementById("friendAttackTo"),
      friendAttackBtn: document.getElementById("friendAttackBtn"),
      friendSplitLeft: document.getElementById("friendSplitLeft"),
      friendSplitRight: document.getElementById("friendSplitRight"),
      friendSplitBtn: document.getElementById("friendSplitBtn"),
      friendSplitBox: document.getElementById("friendSplitBox"),
      friendConfirmSplitBtn: document.getElementById("friendConfirmSplitBtn"),
      friendCancelBtn: document.getElementById("friendCancelBtn"),
      friendMessage: document.getElementById("friendMessage"),
      friendSplitHint: document.getElementById("friendSplitHint"),
      friendOwnState: document.getElementById("friendOwnState"),
      friendOpponentState: document.getElementById("friendOpponentState"),
      friendMiniLog: document.getElementById("friendMiniLog"),
      friendBattleBackLobbyBtn: document.getElementById("friendBattleBackLobbyBtn"),
      friendRestartSimpleBtn: document.getElementById("friendRestartSimpleBtn"),
      friendLobbyBackBtn: document.getElementById("friendLobbyBackBtn"),
      difficultyBackBtn: document.getElementById("difficultyBackBtn"),
      settingsBackBtn: document.getElementById("settingsBackBtn"),
      deckBackMenuBtn: document.getElementById("deckBackMenuBtn"),
      battleBackMenuBtn: document.getElementById("battleBackMenuBtn"),
      battleRestartBtn: document.getElementById("battleRestartBtn"),
      humanState: document.getElementById("humanState"),
      cpuState: document.getElementById("cpuState"),
      splitBox: document.getElementById("splitBox"),
      splitLeft: document.getElementById("splitLeft"),
      splitRight: document.getElementById("splitRight"),
      splitHint: document.getElementById("splitHint"),
      attackBtn: document.getElementById("attackBtn"),
      splitBtn: document.getElementById("splitBtn"),
      drawBtn: document.getElementById("drawBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      resetBtn: document.getElementById("resetBtn"),
      confirmSplitBtn: document.getElementById("confirmSplitBtn"),
      humanCards: document.getElementById("humanCards"),
      humanDeckCount: document.getElementById("humanDeckCount"),
      cpuDeckCount: document.getElementById("cpuDeckCount"),
      handInfo: document.getElementById("handInfo"),
      lastCardDisplay: document.getElementById("lastCardDisplay"),
      overlay: document.getElementById("overlay"),
      popupCard: document.getElementById("popupCard"),
      popupUser: document.getElementById("popupUser"),
      popupName: document.getElementById("popupName"),
      popupText: document.getElementById("popupText"),
      trapChoice: document.getElementById("trapChoice"),
      trapChoiceText: document.getElementById("trapChoiceText"),
      trapChoiceList: document.getElementById("trapChoiceList"),
      trapSkipBtn: document.getElementById("trapSkipBtn"),
      toggleDeckBtn: document.getElementById("toggleDeckBtn"),
      deckPanel: document.getElementById("deckPanel"),
      deckGrid: document.getElementById("deckGrid"),
      deckBottomBar: document.getElementById("deckBottomBar"),
      deckBottomCount: document.getElementById("deckBottomCount"),
      deckBottomCost: document.getElementById("deckBottomCost"),
      deckBottomValid: document.getElementById("deckBottomValid"),
      deckCountText: document.getElementById("deckCountText"),
      deckCostText: document.getElementById("deckCostText"),
      deckValidityText: document.getElementById("deckValidityText"),
      applyDeckBtn: document.getElementById("applyDeckBtn"),
      defaultDeckBtn: document.getElementById("defaultDeckBtn"),
      costLimitInput: document.getElementById("costLimitInput"),
      deckOwnerSelect: document.getElementById("deckOwnerSelect"),
      cpuDifficultySelect: document.getElementById("cpuDifficultySelect"),
      saveDeckBtn: document.getElementById("saveDeckBtn"),
      loadDeckBtn: document.getElementById("loadDeckBtn"),
      copyDeckBtn: document.getElementById("copyDeckBtn"),
      exportCurrentDeckBtn: document.getElementById("exportCurrentDeckBtn"),
      exportBothDecksBtn: document.getElementById("exportBothDecksBtn"),
      copyDeckCodeBtn: document.getElementById("copyDeckCodeBtn"),
      importDeckCodeBtn: document.getElementById("importDeckCodeBtn"),
      deckCodeTargetSelect: document.getElementById("deckCodeTargetSelect"),
      deckCodeBox: document.getElementById("deckCodeBox"),
      openHelpBtn: document.getElementById("openHelpBtn"),
      openCardsHelpBtn: document.getElementById("openCardsHelpBtn"),
      helpModal: document.getElementById("helpModal"),
      helpCloseBtn: document.getElementById("helpCloseBtn"),
      helpTabs: document.getElementById("helpTabs"),
      helpBody: document.getElementById("helpBody")
    };

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function showPopup(player, title, text, kind = "card", ms = 760, html = false) {
      elements.popupCard.className = "popup-card" + (kind === "trap" ? " trap" : "") + (kind === "accel" ? ` accel-flash ${player === "cpu" ? "cpu-accel" : "human-accel"}` : "");
      elements.popupUser.className = "popup-user" + (kind === "trap" ? " trap" : kind === "accel" ? ` action ${player === "cpu" ? "cpu-accel-user" : "human-accel-user"}` : kind === "action" ? " action" : "");
      elements.popupUser.textContent = kind === "trap" ? `${handNames[player]}の罠発動` : kind === "accel" ? `${handNames[player]}の加速` : kind === "action" ? `${handNames[player]}の行動` : `${handNames[player]}が使用`;
      elements.popupName.textContent = title;
      if (html) elements.popupText.innerHTML = text;
      else elements.popupText.textContent = text;
      elements.overlay.classList.add("show");
      await delay(ms);
      elements.overlay.classList.remove("show");
      await delay(80);
      elements.popupText.textContent = "";
    }

    async function showCardPopup(player, card, isTrap = false, ms = 760) {
      await showPopup(player, `「${card.name}」`, card.text, isTrap ? "trap" : "card", ms);
    }

    async function showAccelerationPopup(player, draws, remaining) {
      await showPopup(
        player,
        "過加速",
        `<div class="roulette-pop">${player === "cpu" ? "CPU +1 DRAW" : "+1 DRAW"}</div><div>${handNames[player]}はこのターン${draws}枚ドローします。<br>追加ドロー残り：${remaining}ターン</div>`,
        "accel",
        900,
        true
      );
    }

    async function showNoDrawPopup(player, remaining) {
      await showPopup(
        player,
        "過加速の反動",
        `<div class="roulette-pop">${player === "cpu" ? "CPU NO DRAW" : "NO DRAW"}</div><div>${handNames[player]}はこのターン開始時にカードを引けません。<br>反動残り：${remaining}ターン</div>`,
        "accel",
        900,
        true
      );
    }

    async function showRoulettePopup(player, hand, finalValue) {
      elements.popupCard.className = "popup-card accel-flash";
      elements.popupUser.className = "popup-user action";
      elements.popupUser.textContent = `${handNames[player]}のランダムダイス`;
      elements.popupName.textContent = `${handNames[hand]}をルーレット`;
      elements.overlay.classList.add("show");

      for (let i = 0; i < 12; i++) {
        const value = i === 11 ? finalValue : Math.floor(Math.random() * 5);
        elements.popupText.innerHTML = `<div class="roulette-pop">${value}</div><div>0〜4のどれかに変化します</div>`;
        await delay(i < 7 ? 70 : 110);
      }

      elements.popupText.innerHTML = `<div class="roulette-pop">${finalValue}</div><div>${handNames[hand]}は${finalValue}本になりました。</div>`;
      await delay(520);
      elements.overlay.classList.remove("show");
      elements.popupText.textContent = "";
      await delay(80);
    }

    function setLastAction(player, title, text, kind = "action") {
      state.lastAction = { player, title, text, kind };
    }

    function askHumanTrapChoice(candidates, context) {
      return new Promise(resolve => {
        elements.trapChoiceList.innerHTML = "";
        elements.trapChoiceText.textContent = context.isRapidFire
          ? `${handNames[context.attacker]}の乱射が、あなたの${handNames[context.targetHand]}を攻撃しようとしています。`
          : `${handNames[context.attacker]}の${handNames[context.attackHand]}が、あなたの${handNames[context.targetHand]}を攻撃しようとしています。`;

        candidates.forEach(info => {
          const div = document.createElement("div");
          div.className = "trap-choice-card";
          div.innerHTML = `
            <div class="card-title">
              <span>「${escapeHtml(info.card.name)}」</span>
              <span class="card-type trap">罠</span>
            </div>
            <div class="card-cost">設置場所：${handNames[info.placedHand]} / コスト ${info.card.cost}</div>
            <div class="card-text">${escapeHtml(info.card.text)}</div>
          `;
          div.addEventListener("click", () => {
            cleanup();
            resolve(info);
          });
          elements.trapChoiceList.appendChild(div);
        });

        const cleanup = () => {
          elements.trapChoice.classList.remove("show");
          elements.trapSkipBtn.onclick = null;
        };

        elements.trapSkipBtn.onclick = () => {
          cleanup();
          resolve(null);
        };

        elements.trapChoice.classList.add("show");
      });
    }

    function shuffle(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    
    function makeRoomId() {
      return Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    function buildRoomUrl(roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomId);
      url.searchParams.set("mode", "friend");
      return url.toString();
    }

    function extractRoomId(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      try {
        const url = new URL(raw);
        return (url.searchParams.get("room") || "").trim();
      } catch (_) {
        const match = raw.match(/[?&]room=([^&]+)/);
        return match ? decodeURIComponent(match[1]).trim() : raw.replace(/[^a-zA-Z0-9_-]/g, "").trim().toUpperCase();
      }
    }

    function firebaseApi() {
      return window.WaribashiFirebase && window.WaribashiFirebase.ready ? window.WaribashiFirebase : null;
    }

    function setFriendRoomUi(roomId, role = "host") {
      const cleanId = extractRoomId(roomId) || makeRoomId();
      state.battleMode = "friend";
      state.friendRoomId = cleanId;
      state.friendRole = role;
      state.friendRoomUrl = buildRoomUrl(cleanId);
      elements.roomUrlText.textContent = state.friendRoomUrl;
      elements.roomIdInput.value = cleanId;
      elements.copyRoomUrlBtn.disabled = false;
      history.replaceState(null, "", state.friendRoomUrl);
    }


    const FRIEND_SIMPLE_LIBRARY = {
      insight: { name: "ひらめき", cost: 1, text: "1枚引く。" },
      strongHit: { name: "強打", cost: 2, text: "このターン次の攻撃+1。" },
      lightHit: { name: "軽打", cost: 1, text: "このターン次の攻撃-1。最低1。" },
      lockSplit: { name: "固定", cost: 2, text: "次の相手ターン、相手は分ける不可。" },
      snipe: { name: "狙撃", cost: 2, text: "選択中の相手の手を+1してターン終了。" },
      passCard: { name: "パス", cost: 0, text: "何もせずターン終了。" },
      nekodamashi: { name: "ねこだまし", cost: 2, text: "1枚引く。手札誘発は未対応。" },
      calm: { name: "落ち着ける", cost: 1, text: "手札を1枚捨てて2枚引く。" },
      randomDice: { name: "ランダムダイス", cost: 1, text: "選択中の自分の手を0〜4にランダム変更。" },
      equalTrade: { name: "等価交換", cost: 2, text: "選択中の自分の手-1、相手の手-1。" },
      adjust: { name: "整える", cost: 1, text: "選択中の自分の手からもう片方へ1本移す。カード効果なので片手0可。" },
      repair: { name: "補修", cost: 3, text: "手札1枚を追加で捨て、自分の0の手を1にしてターン終了。" },
      preparation: { name: "戦闘準備", cost: 1, text: "簡易版：山札から補助カードを1枚探して手札へ。" },
      bulletSupply: { name: "弾丸補給", cost: 1, text: "簡易版：山札から狙撃を1枚探して手札へ。" },
      scout: { name: "探り", cost: 1, text: "相手の手札枚数をログに表示。" },
      costLimit: { name: "倹約令", cost: 3, text: "次の相手ターン、相手はコスト2以下のカードしか使えない。" },
      doubleDouble: { name: "ダブルダブル", cost: 3, text: "自分が2-2なら、このターン攻撃/分ける後も自分の番が続く。" },
      overAccel: { name: "過加速", cost: 3, text: "次の自分ターン開始時に追加で1枚引く。" },
      focusShot: { name: "一点狙い", cost: 3, text: "簡易版：山札/捨て札から狙撃を1枚手札へ。" },
      reload: { name: "再装填", cost: 2, text: "簡易版：捨て札から狙撃を1枚手札へ。" },
      breakthrough: { name: "強行突破", cost: 3, text: "簡易版：このターン攻撃+1。" },
      powerBlessing: { name: "力の加護", cost: 2, type: "blessing", text: "選択中の自分の手に表向きで置く。この手で攻撃+1。" },
      guardBlessing: { name: "守護", cost: 2, type: "blessing", text: "選択中の自分の手に表向きで置く。この手が受ける本数を-1、最低1。" },
      growthBlessing: { name: "成長", cost: 2, type: "blessing", text: "選択中の自分の手に表向きで置く。この手で攻撃して相手がちょうど0にならず5なら1枚引く。" },
      slowCurse: { name: "鈍重の呪縛", cost: 2, type: "curse", text: "選択中の相手の手に表向きで置く。この手で攻撃-1、最低1。" },
      immutableCurse: { name: "不変の呪縛", cost: 2, type: "curse", text: "選択中の相手の手に表向きで置く。この手は攻撃力増加を受けない。" },
      sealCurse: { name: "封印の呪縛", cost: 2, type: "curse", text: "選択中の相手の手に表向きで置く。この手には新たに加護を置けない。" },
      rapidFire: { name: "乱射", cost: 2, text: "手札を1枚弾として捨て、選択中の相手の手にそのコスト分。弾なら+1。使用後ターン終了。" },
      accelerationBullet: { name: "加速弾", cost: 1, bullet: true, text: "乱射で捨てると、通常ダメージ後に1枚引く。" },
      specialBullet: { name: "特殊弾", cost: 2, bullet: true, text: "乱射で捨てると、相手の手札をランダムに1枚捨てる。" },
      piercingBullet: { name: "貫通弾", cost: 3, bullet: true, text: "乱射で捨てると、選択中の相手の手の設置カードを1枚捨てる。" },
      logicAtelier: { name: "ロジックアトリエ", cost: 0, bullet: true, token: true, text: "乱射で捨てると、選択中の相手の手を0にする。簡易版トークン。" }
    };

    const FRIEND_SIMPLE_DECK = [
      "insight", "insight", "strongHit", "lightHit", "lockSplit",
      "snipe", "snipe", "passCard", "nekodamashi", "nekodamashi",
      "calm", "randomDice", "equalTrade", "adjust", "repair",
      "preparation", "bulletSupply", "strongHit", "lightHit", "snipe",
      "scout", "costLimit", "doubleDouble", "overAccel", "focusShot",
      "reload", "breakthrough", "passCard", "insight", "snipe",
      "powerBlessing", "guardBlessing", "growthBlessing", "slowCurse",
      "immutableCurse", "sealCurse", "rapidFire", "accelerationBullet",
      "specialBullet", "piercingBullet", "rapidFire", "accelerationBullet"
    ];


    const ONLINE_DECK_LIMIT = 20;
    const ONLINE_DECK_COST_LIMIT = 40;
    const ONLINE_DECK_MAX_SAME = 3;
    const ONLINE_DECK_STORAGE_KEY = "waribashiPvpDeckCountsV47";

    function defaultOnlineDeckCounts() {
      const counts = {};
      FRIEND_SIMPLE_DECK.forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
      });
      return counts;
    }

    function loadOnlineDeckCounts() {
      try {
        const raw = localStorage.getItem(ONLINE_DECK_STORAGE_KEY);
        if (!raw) return defaultOnlineDeckCounts();
        const parsed = JSON.parse(raw);
        const counts = {};
        Object.keys(FRIEND_SIMPLE_LIBRARY).forEach(id => {
          const n = Math.max(0, Math.min(ONLINE_DECK_MAX_SAME, Number(parsed[id]) || 0));
          if (n > 0) counts[id] = n;
        });
        return counts;
      } catch (_) {
        return defaultOnlineDeckCounts();
      }
    }

    function saveOnlineDeckCounts() {
      localStorage.setItem(ONLINE_DECK_STORAGE_KEY, JSON.stringify(state.onlineDeckCounts || defaultOnlineDeckCounts()));
    }

    function onlineDeckListFromCounts(counts = state.onlineDeckCounts) {
      const deck = [];
      Object.entries(counts || {}).forEach(([id, count]) => {
        for (let i = 0; i < count; i++) deck.push(id);
      });
      return deck;
    }

    function onlineDeckStats(counts = state.onlineDeckCounts) {
      let cards = 0;
      let cost = 0;
      Object.entries(counts || {}).forEach(([id, count]) => {
        const card = friendCardInfo(id);
        cards += count;
        cost += (Number(card.cost) || 0) * count;
      });
      return { cards, cost };
    }

    function onlineDeckIsValid(counts = state.onlineDeckCounts) {
      const stats = onlineDeckStats(counts);
      return stats.cards > 0 && stats.cards <= ONLINE_DECK_LIMIT && stats.cost <= ONLINE_DECK_COST_LIMIT;
    }


    function encodeOnlineDeckCode(counts = state.onlineDeckCounts) {
      const compact = {};
      Object.keys(counts || {}).sort().forEach(id => {
        const n = counts[id] || 0;
        if (n > 0) compact[id] = n;
      });
      const json = JSON.stringify({ v: 1, counts: compact });
      return "WBPVP1:" + btoa(unescape(encodeURIComponent(json)));
    }

    function decodeOnlineDeckCode(code) {
      const raw = String(code || "").trim();
      if (!raw) throw new Error("コードが空です。");
      const body = raw.startsWith("WBPVP1:") ? raw.slice("WBPVP1:".length) : raw;
      const json = decodeURIComponent(escape(atob(body)));
      const parsed = JSON.parse(json);
      const source = parsed.counts || parsed;
      const counts = {};
      Object.keys(source).forEach(id => {
        if (!FRIEND_SIMPLE_LIBRARY[id]) return;
        const n = Math.max(0, Math.min(ONLINE_DECK_MAX_SAME, Number(source[id]) || 0));
        if (n > 0) counts[id] = n;
      });
      if (!onlineDeckIsValid(counts)) throw new Error("デッキ条件を満たしていません。20枚以内・コスト40以内・1枚以上にしてください。");
      return counts;
    }

    function onlineDeckSlotKey() {
      const slot = elements.onlineDeckSlotSelect ? elements.onlineDeckSlotSelect.value : "1";
      return `${ONLINE_DECK_STORAGE_KEY}_slot_${slot}`;
    }

    function renderOnlineDeckEditor() {
      if (!state.onlineDeckCounts) state.onlineDeckCounts = loadOnlineDeckCounts();
      const counts = state.onlineDeckCounts;
      const stats = onlineDeckStats(counts);
      if (elements.onlineDeckSummary) {
        elements.onlineDeckSummary.textContent = `${stats.cards}枚 / コスト${stats.cost}`;
      }
      if (elements.onlineDeckMessage) {
        elements.onlineDeckMessage.textContent = onlineDeckIsValid(counts)
          ? "このデッキでオンライン対戦できます。"
          : "20枚以内・コスト40以内・1枚以上にしてください。";
      }
      if (!elements.onlineDeckList) return;
      elements.onlineDeckList.innerHTML = "";
      Object.keys(FRIEND_SIMPLE_LIBRARY).forEach(id => {
        const card = friendCardInfo(id);
        const row = document.createElement("div");
        row.className = "online-deck-row";
        const count = counts[id] || 0;
        row.innerHTML = `
          <div>
            <strong>${card.name}</strong>
            <small>コスト ${card.cost} / ${card.type === "blessing" ? "加護" : card.type === "curse" ? "呪縛" : card.bullet ? "弾" : "カード"}：${card.text}</small>
          </div>
          <div class="online-deck-controls">
            <button type="button" data-online-deck-minus="${id}" class="secondary">−</button>
            <span class="online-deck-count">${count}</span>
            <button type="button" data-online-deck-plus="${id}">＋</button>
          </div>
        `;
        elements.onlineDeckList.appendChild(row);
      });

      elements.onlineDeckList.querySelectorAll("[data-online-deck-minus]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.onlineDeckMinus;
          counts[id] = Math.max(0, (counts[id] || 0) - 1);
          if (counts[id] === 0) delete counts[id];
          saveOnlineDeckCounts();
          renderOnlineDeckEditor();
        });
      });

      elements.onlineDeckList.querySelectorAll("[data-online-deck-plus]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.onlineDeckPlus;
          const current = counts[id] || 0;
          if (current >= ONLINE_DECK_MAX_SAME) return;
          counts[id] = current + 1;
          const stats = onlineDeckStats(counts);
          if (stats.cards > ONLINE_DECK_LIMIT || stats.cost > ONLINE_DECK_COST_LIMIT) {
            counts[id] = current;
            if (elements.onlineDeckMessage) elements.onlineDeckMessage.textContent = "デッキ上限を超えます。20枚以内・コスト40以内です。";
            return;
          }
          saveOnlineDeckCounts();
          renderOnlineDeckEditor();
        });
      });
    }

    function makeFriendDeck() {
      if (!state.onlineDeckCounts) state.onlineDeckCounts = loadOnlineDeckCounts();
      const customDeck = onlineDeckListFromCounts(state.onlineDeckCounts);
      return shuffle(customDeck.length ? customDeck : FRIEND_SIMPLE_DECK);
    }

    function drawFriendCard(game, role, count = 1) {
      const deck = [...(game[role].deck || [])];
      const hand = [...(game[role].hand || [])];
      const discard = [...(game[role].discard || [])];
      for (let i = 0; i < count; i++) {
        if (deck.length > 0) hand.push(deck.shift());
      }
      return { ...game[role], deck, hand, discard };
    }

    function makeSideState(deck) {
      return { L: 1, R: 1, deck: shuffle(deck && deck.length ? deck : onlineDeckListFromCounts(loadOnlineDeckCounts())), hand: [], discard: [], attachments: { L: [], R: [] }, attackBonus: 0, noSplit: false, cardPlayed: false, extraAction: false, extraDrawNext: 0, costLimit: null };
    }

    function emptyFriendGameState(hostDeck = null, guestDeck = null) {
      let game = {
        started: true,
        mode: "simple-card",
        turn: "host",
        phase: "action",
        host: makeSideState(hostDeck),
        guest: makeSideState(guestDeck),
        winner: null,
        log: ["簡易カード試合を開始しました。ホスト/ゲストそれぞれのPVPデッキを使用します。"]
      };
      game.host = drawFriendCard(game, "host", 3);
      game.guest = drawFriendCard(game, "guest", 3);
      game.host = drawFriendCard(game, "host", 1);
      game.log.push("ホストのターン。1枚ドロー。");
      return game;
    }

    function friendRoleOpponent(role) {
      return role === "host" ? "guest" : "host";
    }

    function friendRoleLabel(role) {
      return role === "host" ? "ホスト" : "ゲスト";
    }

    function friendHandText(side) {
      return `左${side?.L ?? 0} / 右${side?.R ?? 0}`;
    }

    function friendCardInfo(cardId) {
      const fallback = {
        insight: { name: "ひらめき", cost: 1, text: "1枚引く。" },
        strongHit: { name: "強打", cost: 2, text: "このターン次の攻撃+1。" },
        lightHit: { name: "軽打", cost: 1, text: "このターン次の攻撃-1。" },
        lockSplit: { name: "固定", cost: 2, text: "次の相手ターン、相手は分ける不可。" },
        snipe: { name: "狙撃", cost: 2, text: "選択中の相手の手を+1。" },
        passCard: { name: "パス", cost: 0, text: "ターン終了。" },
        nekodamashi: { name: "ねこだまし", cost: 2, text: "1枚引く。" },
        calm: { name: "落ち着ける", cost: 1, text: "手札を1枚捨てて2枚引く。" },
        randomDice: { name: "ランダムダイス", cost: 1, text: "選択中の自分の手を0〜4に変更。" },
        equalTrade: { name: "等価交換", cost: 2, text: "自分-1、相手-1。" },
        adjust: { name: "整える", cost: 1, text: "自分の手からもう片方へ1本移す。" },
        repair: { name: "補修", cost: 3, text: "0の手を1で復活。" },
        preparation: { name: "戦闘準備", cost: 1, text: "補助カードを探す。" },
        bulletSupply: { name: "弾丸補給", cost: 1, text: "狙撃を探す。" },
        scout: { name: "探り", cost: 1, text: "相手の手札枚数確認。" },
        costLimit: { name: "倹約令", cost: 3, text: "相手の次ターンはコスト2以下だけ。" },
        doubleDouble: { name: "ダブルダブル", cost: 3, text: "2-2なら追加行動。" },
        overAccel: { name: "過加速", cost: 3, text: "次の自分ターンに追加ドロー。" },
        focusShot: { name: "一点狙い", cost: 3, text: "狙撃を探す。" },
        reload: { name: "再装填", cost: 2, text: "捨て札から狙撃。" },
        breakthrough: { name: "強行突破", cost: 3, text: "簡易版：攻撃+1。" },
        powerBlessing: { name: "力の加護", cost: 2, type: "blessing", text: "自分の手に置く。攻撃+1。" },
        guardBlessing: { name: "守護", cost: 2, type: "blessing", text: "自分の手に置く。受ける本数-1。" },
        growthBlessing: { name: "成長", cost: 2, type: "blessing", text: "自分の手に置く。攻撃後条件で1枚引く。" },
        slowCurse: { name: "鈍重の呪縛", cost: 2, type: "curse", text: "相手の手に置く。攻撃-1。" },
        immutableCurse: { name: "不変の呪縛", cost: 2, type: "curse", text: "相手の手に置く。攻撃増加無効。" },
        sealCurse: { name: "封印の呪縛", cost: 2, type: "curse", text: "相手の手に置く。加護を置けない。" },
        rapidFire: { name: "乱射", cost: 2, text: "手札を弾として捨ててダメージ。" },
        accelerationBullet: { name: "加速弾", cost: 1, bullet: true, text: "乱射で捨てると1枚引く。" },
        specialBullet: { name: "特殊弾", cost: 2, bullet: true, text: "乱射で捨てると相手手札破壊。" },
        piercingBullet: { name: "貫通弾", cost: 3, bullet: true, text: "乱射で捨てると設置カード破壊。" },
        logicAtelier: { name: "ロジックアトリエ", cost: 0, bullet: true, token: true, text: "乱射で捨てると相手の手を0。" }
      };
      return FRIEND_SIMPLE_LIBRARY[cardId] || fallback[cardId] || { name: `未対応:${cardId}`, cost: "?", text: "この部屋に古い版/別版のカードIDが残っています。" };
    }

    function friendHandKey(role, hand) {
      return `${role}_${hand}`;
    }

    function animateFriendHandChange(button, oldValue, newValue) {
      if (!button || oldValue === undefined || oldValue === null || oldValue === newValue) return;
      const className = newValue > oldValue ? "bump" : "drop";
      button.classList.remove("bump", "drop");
      void button.offsetWidth;
      button.classList.add(className);
      window.setTimeout(() => button.classList.remove(className), 460);
    }

    function updateFriendHandButton(button, value, selectedClass, isSelected, ownerRole) {
      if (!button) return;
      const hand = button.dataset.hand;
      const key = friendHandKey(ownerRole || button.dataset.role, hand);
      const nextValue = value ?? 0;
      const oldValue = state.friendLastHandValues ? state.friendLastHandValues[key] : undefined;
      animateFriendHandChange(button, oldValue, nextValue);
      const num = button.querySelector(".fingers");
      const icons = button.querySelector(".finger-icons");
      if (num) num.textContent = String(nextValue);
      if (icons) icons.textContent = "●".repeat(Math.max(0, nextValue));
      button.classList.toggle(selectedClass, !!isSelected);
      button.classList.toggle("selected", selectedClass === "selected-own" && !!isSelected);
      button.classList.toggle("hit-target", selectedClass === "selected-target" && !!isSelected);
      button.classList.toggle("zero", nextValue <= 0);
      button.classList.toggle("dead", nextValue <= 0);
    }

    function syncFriendHandSelections(game) {
      if (!game?.started) return;
      const role = state.friendRole;
      const opp = friendRoleOpponent(role);
      const own = game[role] || {};
      const enemy = game[opp] || {};

      if ((own[state.friendSelectedOwnHand] || 0) <= 0) {
        state.friendSelectedOwnHand = (own.L || 0) > 0 ? "L" : "R";
      }
      if ((enemy[state.friendSelectedTargetHand] || 0) <= 0) {
        state.friendSelectedTargetHand = (enemy.L || 0) > 0 ? "L" : "R";
      }

      elements.friendAttackFrom.value = state.friendSelectedOwnHand;
      elements.friendAttackTo.value = state.friendSelectedTargetHand;

      // Legacy hidden elements, kept for compatibility with older code.
      updateFriendHandButton(elements.friendHostLeft, game.host?.L, "selected-own", role === "host" && state.friendSelectedOwnHand === "L", "host");
      updateFriendHandButton(elements.friendHostRight, game.host?.R, "selected-own", role === "host" && state.friendSelectedOwnHand === "R", "host");
      updateFriendHandButton(elements.friendGuestLeft, game.guest?.L, "selected-own", role === "guest" && state.friendSelectedOwnHand === "L", "guest");
      updateFriendHandButton(elements.friendGuestRight, game.guest?.R, "selected-own", role === "guest" && state.friendSelectedOwnHand === "R", "guest");

      // Mobile CPU-like visible elements. Idle hand taps no longer create persistent selection highlighting.
      const pending = state.friendPendingTapAction;
      const ownSelectionVisible = !!pending && ["attackFrom", "attackTo", "ownHand", "equalOwn", "equalOpponent"].includes(pending.type);
      const targetSelectionVisible = !!pending && ["attackTo", "opponentHand", "equalOpponent"].includes(pending.type);
      updateFriendHandButton(elements.friendOwnLeft, own.L, "selected-own", ownSelectionVisible && state.friendSelectedOwnHand === "L", role);
      updateFriendHandButton(elements.friendOwnRight, own.R, "selected-own", ownSelectionVisible && state.friendSelectedOwnHand === "R", role);
      updateFriendHandButton(elements.friendOpponentLeft, enemy.L, "selected-target", targetSelectionVisible && state.friendSelectedTargetHand === "L", opp);
      updateFriendHandButton(elements.friendOpponentRight, enemy.R, "selected-target", targetSelectionVisible && state.friendSelectedTargetHand === "R", opp);

      [elements.friendOwnLeft, elements.friendOwnRight, elements.friendOpponentLeft, elements.friendOpponentRight].forEach(btn => btn?.classList.remove("pending-pick", "selectable"));
      if (pending) {
        if (["attackFrom", "ownHand", "equalOwn"].includes(pending.type)) {
          elements.friendOwnLeft?.classList.add("pending-pick", "selectable");
          elements.friendOwnRight?.classList.add("pending-pick", "selectable");
        }
        if (["attackTo", "opponentHand", "equalOpponent"].includes(pending.type)) {
          elements.friendOpponentLeft?.classList.add("pending-pick", "selectable");
          elements.friendOpponentRight?.classList.add("pending-pick", "selectable");
        }
      }

      elements.friendHostLeft.classList.toggle("selected-target", role === "guest" && state.friendSelectedTargetHand === "L");
      elements.friendHostRight.classList.toggle("selected-target", role === "guest" && state.friendSelectedTargetHand === "R");
      elements.friendGuestLeft.classList.toggle("selected-target", role === "host" && state.friendSelectedTargetHand === "L");
      elements.friendGuestRight.classList.toggle("selected-target", role === "host" && state.friendSelectedTargetHand === "R");

      state.friendLastHandValues = {
        host_L: game.host?.L ?? 0,
        host_R: game.host?.R ?? 0,
        guest_L: game.guest?.L ?? 0,
        guest_R: game.guest?.R ?? 0
      };
    }


    function friendAttachments(side, hand) {
      if (!side.attachments) side.attachments = { L: [], R: [] };
      if (!side.attachments.L) side.attachments.L = [];
      if (!side.attachments.R) side.attachments.R = [];
      return side.attachments[hand] || [];
    }

    function friendHasAttachment(side, hand, cardId) {
      return friendAttachments(side, hand).includes(cardId);
    }

    function friendCanAddAttachment(side, hand, cardId) {
      const card = friendCardInfo(cardId);
      const list = friendAttachments(side, hand);
      if ((side[hand] || 0) <= 0) return false;
      if (list.length >= 2) return false;
      if (card.type === "blessing" && friendHasAttachment(side, hand, "sealCurse")) return false;
      return true;
    }

    function friendAddAttachment(side, hand, cardId) {
      const next = { ...side, attachments: { L: [...friendAttachments(side, "L")], R: [...friendAttachments(side, "R")] } };
      next.attachments[hand].push(cardId);
      return next;
    }

    function friendClearAttachmentsIfDead(side) {
      const next = { ...side, attachments: { L: [...friendAttachments(side, "L")], R: [...friendAttachments(side, "R")] } };
      if ((next.L || 0) <= 0) next.attachments.L = [];
      if ((next.R || 0) <= 0) next.attachments.R = [];
      return next;
    }

    function renderFriendAttachments(container, side, hand) {
      if (!container) return;
      const list = friendAttachments(side || {}, hand);
      container.innerHTML = "";
      for (let i = 0; i < 2; i++) {
        const cardId = list[i];
        const slot = document.createElement("div");
        if (cardId) {
          const card = friendCardInfo(cardId);
          slot.className = `trap-slot filled revealed-info${card.type === "curse" ? " curse-slot" : " blessing-slot"}`;
          slot.textContent = card.name;
        } else {
          slot.className = "trap-slot";
          slot.textContent = "空き";
        }
        container.appendChild(slot);
      }
    }

    function friendApplyGuard(defenderSide, targetHand, amount, logs) {
      if (amount <= 0) return amount;
      if (friendHasAttachment(defenderSide, targetHand, "guardBlessing")) {
        const reduced = Math.max(1, amount - 1);
        logs.push(`守護：受ける本数 ${amount}→${reduced}。`);
        return reduced;
      }
      return amount;
    }

    function friendWrap(value) {
      return value >= 5 ? value % 5 : value;
    }

    function friendIsDead(side) {
      return (side?.L || 0) === 0 && (side?.R || 0) === 0;
    }

    function friendCanAct(game) {
      return !!game?.started && !game?.winner && game.turn === state.friendRole;
    }

    function friendLogLines(game) {
      const lines = Array.isArray(game?.log) ? game.log : [];
      return lines.slice(-10).reverse().join("\\n") || "ログはまだありません。";
    }

    function friendEndTurn(game, currentRole, extraLog = []) {
      const opp = friendRoleOpponent(currentRole);
      const hadExtraAction = !!game[currentRole]?.extraAction;
      const nextSide = { ...game[opp], attackBonus: 0, cardPlayed: false };
      const currentSide = { ...game[currentRole], attackBonus: 0, noSplit: false, extraAction: false, costLimit: null };
      let nextGame = {
        ...game,
        [currentRole]: currentSide,
        [opp]: nextSide,
        turn: hadExtraAction ? currentRole : opp,
        phase: "action",
        log: [...(game.log || []), ...extraLog]
      };

      if (hadExtraAction && !nextGame.winner) {
        nextGame[currentRole] = drawFriendCard(nextGame, currentRole, 1);
        nextGame[currentRole].cardPlayed = false;
        nextGame.log.push(`${friendRoleLabel(currentRole)}は追加行動。1枚ドロー。`);
      } else if (!nextGame.winner) {
        let drawCount = 1 + (nextGame[opp].extraDrawNext || 0);
        nextGame[opp] = { ...nextGame[opp], extraDrawNext: 0 };
        nextGame[opp] = drawFriendCard(nextGame, opp, drawCount);
        nextGame[opp].noSplit = !!nextGame[opp].noSplit;
        nextGame[opp].cardPlayed = false;
        nextGame.log.push(`${friendRoleLabel(opp)}のターン。${drawCount}枚ドロー。`);
      }
      nextGame.log = nextGame.log.slice(-30);
      return nextGame;
    }

    function renderFriendHandCards(game = state.friendRoomData?.game) {
      if (!elements.friendHandCards) return;
      if (!game?.started || !state.friendRole) {
        elements.friendHandCards.textContent = "手札はまだありません。";
        return;
      }
      const mySide = game[state.friendRole];
      const myTurn = friendCanAct(game);
      const cardLocked = !!mySide?.cardPlayed;
      const costLimit = mySide?.costLimit;
      const pendingRapid = state.friendPendingRapidFire;
      const pendingDiscard = state.friendPendingDiscardAction;
      const hand = mySide?.hand || [];
      if (hand.length === 0) {
        elements.friendHandCards.textContent = pendingRapid
          ? "捨てるカードがありません。乱射をキャンセルしてください。"
          : pendingDiscard
            ? "捨てるカードがありません。キャンセルしてください。"
            : "手札はありません。";
      } else {
        elements.friendHandCards.innerHTML = "";
      }

      if (pendingRapid) {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "friend-simple-card rapid-cancel";
        cancelBtn.innerHTML = `<strong>乱射をキャンセル</strong><span>カード使用を取り消します</span><span>捨てるカードを選ばない場合はこちら</span>`;
        cancelBtn.addEventListener("click", () => friendCancelRapidFire().catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `乱射キャンセルエラー：${error.message || error}`;
        }));
        elements.friendHandCards.appendChild(cancelBtn);
      }

      if (pendingDiscard) {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "friend-simple-card rapid-cancel";
        cancelBtn.innerHTML = `<strong>${pendingDiscard.label || "カード効果"}をキャンセル</strong><span>カード使用を取り消します</span><span>捨てるカードを選ばない場合はこちら</span>`;
        cancelBtn.addEventListener("click", () => friendCancelDiscardAction().catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `キャンセルエラー：${error.message || error}`;
        }));
        elements.friendHandCards.appendChild(cancelBtn);
      }

      hand.forEach((cardId, index) => {
        const card = friendCardInfo(cardId);
        const btn = document.createElement("button");
        btn.className = "friend-simple-card";
        if (pendingRapid) {
          btn.classList.add("rapid-selectable");
          btn.disabled = !myTurn;
          btn.innerHTML = `<strong>${card.name}</strong><span>コスト ${card.cost}${card.bullet ? " / 弾" : ""}</span><span>タップして乱射の弾として捨てる</span>`;
          btn.addEventListener("click", () => friendChooseRapidFireAmmo(index).catch(error => {
            console.error(error);
            elements.friendLobbyMessage.textContent = `乱射エラー：${error.message || error}`;
          }));
        } else if (pendingDiscard) {
          btn.classList.add("discard-selectable");
          btn.disabled = !myTurn;
          btn.innerHTML = `<strong>${card.name}</strong><span>コスト ${card.cost}</span><span>タップして捨てる</span>`;
          btn.addEventListener("click", () => friendResolveDiscardAction(index).catch(error => {
            console.error(error);
            elements.friendLobbyMessage.textContent = `捨て札選択エラー：${error.message || error}`;
          }));
        } else {
          const overCostLimit = costLimit !== null && costLimit !== undefined && Number(card.cost) > Number(costLimit);
          btn.disabled = !myTurn || cardLocked || overCostLimit;
          btn.classList.toggle("card-used-locked", cardLocked || overCostLimit);
          const disabledText = cardLocked ? "このターンはカード使用済み" : overCostLimit ? `倹約令中：コスト${costLimit}以下のみ` : card.text;
          btn.innerHTML = `<strong>${card.name}</strong><span>コスト ${card.cost}</span><span>${disabledText}</span>`;
          btn.addEventListener("click", () => friendUseCardAction(index).catch(error => {
            console.error(error);
            elements.friendLobbyMessage.textContent = `カード使用エラー：${error.message || error}`;
          }));
        }
        elements.friendHandCards.appendChild(btn);
      });
    }

    function friendPrepareSplitEditor(game = state.friendRoomData?.game) {
      if (!game?.started || !state.friendRole) return;
      const me = game[state.friendRole] || { L: 1, R: 1 };
      const fill = (select, selected) => {
        if (!select) return;
        select.innerHTML = "";
        for (let value = 1; value <= 4; value += 1) {
          const option = document.createElement("option");
          option.value = String(value);
          option.textContent = String(value);
          option.selected = value === selected;
          select.appendChild(option);
        }
      };
      fill(elements.friendSplitLeft, Math.max(1, me.L || 1));
      fill(elements.friendSplitRight, Math.max(1, me.R || 1));
      if (elements.friendSplitHint) elements.friendSplitHint.textContent = `現在 ${me.L}-${me.R} / 合計 ${me.L + me.R}。両手とも1〜4で、合計を変えずに分け直します。`;
    }

    function friendCloseActionEditors(resetPending = false) {
      elements.friendSplitBox?.classList.remove("active");
      if (resetPending) {
        state.friendPendingTapAction = null;
        state.friendPendingRapidFire = null;
        state.friendPendingDiscardAction = null;
      }
    }

    function updateFriendGameView(game = state.friendRoomData?.game) {
      if (!elements.friendGameStatus) return;
      const host = game?.host || { L: 1, R: 1, deck: [], hand: [], discard: [], attachments: { L: [], R: [] } };
      const guest = game?.guest || { L: 1, R: 1, deck: [], hand: [], discard: [], attachments: { L: [], R: [] } };
      elements.friendHostHands.textContent = friendHandText(host);
      elements.friendGuestHands.textContent = friendHandText(guest);
      if (elements.friendHostDeckInfo) elements.friendHostDeckInfo.textContent = `山札${host.deck?.length ?? 0} / 手札${host.hand?.length ?? 0}`;
      if (elements.friendGuestDeckInfo) elements.friendGuestDeckInfo.textContent = `山札${guest.deck?.length ?? 0} / 手札${guest.hand?.length ?? 0}`;
      if (state.friendRole && game?.started) {
        const own = game[state.friendRole] || {};
        const opp = game[friendRoleOpponent(state.friendRole)] || {};
        if (elements.friendOwnDeckInfo) elements.friendOwnDeckInfo.textContent = `山札${own.deck?.length ?? 0} / 手札${own.hand?.length ?? 0}`;
        if (elements.friendOpponentDeckInfo) elements.friendOpponentDeckInfo.textContent = `山札${opp.deck?.length ?? 0} / 手札${opp.hand?.length ?? 0}`;
      }
      if (game?.started && state.friendRole) {
        const own = game[state.friendRole] || {};
        const oppSide = game[friendRoleOpponent(state.friendRole)] || {};
        renderFriendAttachments(elements.friendOwnLeftAttach, own, "L");
        renderFriendAttachments(elements.friendOwnRightAttach, own, "R");
        renderFriendAttachments(elements.friendOpponentLeftAttach, oppSide, "L");
        renderFriendAttachments(elements.friendOpponentRightAttach, oppSide, "R");
      }
      if (elements.friendMiniLog) elements.friendMiniLog.textContent = friendLogLines(game);
      if (elements.friendYourRoleText) elements.friendYourRoleText.textContent = state.friendRole ? friendRoleLabel(state.friendRole) : "---";
      if (elements.friendTurnText) elements.friendTurnText.textContent = game?.turn ? friendRoleLabel(game.turn) : "---";
      if (game?.started) syncFriendHandSelections(game);
      if (elements.friendSelectHint) {
        elements.friendSelectHint.textContent = state.friendPendingRapidFire
          ? (state.friendPendingRapidFire.stage === "target" ? "乱射：攻撃する相手の手をタップ" : "乱射：捨てるカードを手札からタップ")
          : state.friendPendingDiscardAction
            ? `${state.friendPendingDiscardAction.label || "カード効果"}：捨てるカードを手札からタップ`
            : state.friendPendingTapAction
              ? friendPendingMessage()
              : "攻撃・分ける・カードを選んで行動してください。";
      }
      renderFriendHandCards(game);
      handleFriendFx(game);

      const hostReady = !!state.friendRoomData?.hostReady;
      const guestReady = !!state.friendRoomData?.guestReady;
      const bothReady = hostReady && guestReady;
      const isHost = state.friendRole === "host";

      elements.friendStartGameBtn.disabled = !isHost || !bothReady || !!game?.started;

      if (!game?.started) {
        const text = bothReady
          ? (isHost ? "2人とも準備完了です。ホストは簡易カード試合を開始できます。" : "2人とも準備完了です。ホストの開始を待っています。")
          : "まだ試合は始まっていません。2人とも準備完了すると開始できます。";
        elements.friendGameStatus.textContent = text;
        if (elements.friendBattleStatus) elements.friendBattleStatus.textContent = text;
        elements.friendAttackBtn.disabled = true;
        elements.friendSplitBtn.disabled = true;
        if (elements.friendConfirmSplitBtn) elements.friendConfirmSplitBtn.disabled = true;
        if (elements.friendOwnState) elements.friendOwnState.textContent = "待機中";
        if (elements.friendOpponentState) elements.friendOpponentState.textContent = "待機中";
        return;
      }

      if (game.winner) {
        const text = `${game.winner === state.friendRole ? "あなたの勝ちです！" : "相手の勝ちです。"}`;
        elements.friendGameStatus.textContent = text;
        if (elements.friendBattleStatus) elements.friendBattleStatus.textContent = text;
        elements.friendAttackBtn.disabled = true;
        elements.friendSplitBtn.disabled = true;
        if (elements.friendConfirmSplitBtn) elements.friendConfirmSplitBtn.disabled = true;
        if (elements.friendOwnState) elements.friendOwnState.textContent = "待機中";
        if (elements.friendOpponentState) elements.friendOpponentState.textContent = "待機中";
        return;
      }

      const myTurn = friendCanAct(game);
      const usedText = (game[state.friendRole]?.cardPlayed) ? "カード使用済み。攻撃か分けるでターンを進めてください。" : "カード使用、攻撃、分けるができます。";
      const text = myTurn ? `あなたの番です。${usedText}` : "相手の番です。相手の行動を待っています。";
      elements.friendGameStatus.textContent = text;
      if (elements.friendBattleStatus) elements.friendBattleStatus.textContent = text;
      elements.friendAttackBtn.disabled = !myTurn;
      elements.friendSplitBtn.disabled = !myTurn;
      if (elements.friendConfirmSplitBtn) elements.friendConfirmSplitBtn.disabled = !myTurn;
      if (elements.friendOwnState) elements.friendOwnState.textContent = myTurn ? "あなたの番です" : "相手の行動を待っています";
      if (elements.friendOpponentState) elements.friendOpponentState.textContent = myTurn ? "待機中" : "相手の番です";
      if (elements.friendMessage) {
        elements.friendMessage.textContent = state.friendPendingRapidFire
          ? "乱射：弾として捨てるカードを手札から選んでください。"
          : state.friendPendingDiscardAction
            ? `${state.friendPendingDiscardAction.label || "カード効果"}：捨てるカードを手札から選んでください。`
            : state.friendPendingTapAction
              ? friendPendingMessage()
              : myTurn
                ? "攻撃する場合は「攻撃」を押し、自分の手、相手の手の順にタップしてください。カードも手札から直接使えます。"
                : "相手の番です。相手の行動が同期されるまでお待ちください。";
      }

      if (state.currentScreen === "friendLobby" && game.started && !game.winner) {
        showScreen("friendBattle");
      }
    }

    async function updateFriendGame(updater) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      const snapshot = await fb.getDoc(roomRef);
      if (!snapshot.exists()) {
        elements.friendLobbyMessage.textContent = "部屋が見つかりません。";
        return;
      }
      const data = snapshot.data();
      const next = updater(data);
      if (!next) return;

      if (next.game && !next.game.fx) {
        const beforeLogs = Array.isArray(data.game?.log) ? data.game.log : [];
        const afterLogs = Array.isArray(next.game.log) ? next.game.log : [];
        const addedLogs = afterLogs.slice(Math.min(beforeLogs.length, afterLogs.length));
        const candidates = addedLogs.length ? addedLogs : afterLogs.slice(-6);
        let cardMatch = null;
        for (let i = candidates.length - 1; i >= 0; i--) {
          const match = String(candidates[i] || "").match(/(ホスト|ゲスト)：「([^」]+)」を使用/);
          if (match) { cardMatch = match; break; }
        }
        if (cardMatch) {
          next.game.fx = makeFriendFx("card", {
            role: cardMatch[1] === "ホスト" ? "host" : "guest",
            cardName: cardMatch[2],
            detail: `${cardMatch[1]}が使用`
          });
        }
      }

      await fb.setDoc(roomRef, {
        ...next,
        updatedAt: fb.serverTimestamp()
      }, { merge: true });

      // スマホ環境でonSnapshotの反映が遅れる場合に備え、書き込み直後にも再取得して画面更新する。
      try {
        const updated = await fb.getDoc(roomRef);
        if (updated.exists()) {
          state.friendRoomData = updated.data();
          updateFriendLobbyView(state.friendRoomData);
        }
      } catch (_) {}
    }

    async function startFriendSimpleGame() {
      if (state.friendRole !== "host") {
        elements.friendLobbyMessage.textContent = "簡易カード試合を開始できるのはホストだけです。";
        return;
      }
      await updateFriendGame((data) => {
        if (!data.hostReady || !data.guestReady) {
          elements.friendLobbyMessage.textContent = "2人とも準備完了してから開始してください。";
          return null;
        }
        return {
          status: "playing",
          game: emptyFriendGameState(data.hostDeck || null, data.guestDeck || null)
        };
      });
      showScreen("friendBattle");
    }

    function takeCardFromDeck(side, predicate) {
      const deck = [...(side.deck || [])];
      const index = deck.findIndex(predicate);
      if (index < 0) return { side, found: null };
      const [found] = deck.splice(index, 1);
      return { side: { ...side, deck, hand: [...(side.hand || []), found] }, found };
    }


    function takeCardFromDiscard(side, predicate) {
      const discard = [...(side.discard || [])];
      const index = discard.findIndex(predicate);
      if (index < 0) return { side, found: null };
      const [found] = discard.splice(index, 1);
      return { side: { ...side, discard, hand: [...(side.hand || []), found] }, found };
    }

    function takeCardFromDeckOrDiscard(side, predicate) {
      const fromDeck = takeCardFromDeck(side, predicate);
      if (fromDeck.found) return fromDeck;
      return takeCardFromDiscard(fromDeck.side, predicate);
    }


    function friendDiscardRandomHandCard(side) {
      const next = { ...side, hand: [...(side.hand || [])], discard: [...(side.discard || [])] };
      if (!next.hand.length) return { side: next, discarded: null };
      const index = Math.floor(Math.random() * next.hand.length);
      const [discarded] = next.hand.splice(index, 1);
      next.discard.push(discarded);
      return { side: next, discarded };
    }

    function friendRemoveOneAttachment(side, hand) {
      const next = { ...side, attachments: { L: [...friendAttachments(side || {}, "L")], R: [...friendAttachments(side || {}, "R")] } };
      const list = next.attachments[hand] || [];
      if (!list.length) return { side: next, removed: null };
      const removed = list.shift();
      next.attachments[hand] = list;
      return { side: next, removed };
    }



    function friendSetPendingTapAction(action) {
      state.friendPendingTapAction = action;
      state.friendPendingRapidFire = null;
      renderFriendHandCards(state.friendRoomData?.game);
      updateFriendGameView(state.friendRoomData?.game);
    }

    function friendClearPendingTapAction() {
      state.friendPendingTapAction = null;
      updateFriendGameView(state.friendRoomData?.game);
    }

    function friendPendingMessage() {
      const a = state.friendPendingTapAction;
      if (!a) return "";
      if (a.type === "attackFrom") return "攻撃：自分の攻撃する手をタップ";
      if (a.type === "attackTo") return "攻撃：攻撃する相手の手をタップ";
      if (a.type === "ownHand") return `${a.label || "カード"}：自分の手をタップ`;
      if (a.type === "opponentHand") return `${a.label || "カード"}：相手の手をタップ`;
      if (a.type === "equalOwn") return "等価交換：まず自分の手をタップ";
      if (a.type === "equalOpponent") return "等価交換：次に相手の手をタップ";
      return "対象をタップ";
    }

    function friendHandleTapAction(side, hand) {
      const a = state.friendPendingTapAction;
      if (!a) return false;
      if (a.type === "attackFrom") {
        if (side !== "own") return true;
        state.friendSelectedOwnHand = hand;
        elements.friendAttackFrom.value = hand;
        state.friendPendingTapAction = { type: "attackTo", from: hand };
        updateFriendGameView(state.friendRoomData?.game);
        return true;
      }
      if (a.type === "attackTo") {
        if (side !== "opponent") return true;
        state.friendSelectedTargetHand = hand;
        elements.friendAttackTo.value = hand;
        const from = a.from || state.friendSelectedOwnHand;
        state.friendPendingTapAction = null;
        friendAttackAction(from, hand).catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `攻撃同期エラー：${error.message || error}`;
        });
        return true;
      }
      if (a.type === "ownHand") {
        if (side !== "own") return true;
        state.friendSelectedOwnHand = hand;
        elements.friendAttackFrom.value = hand;
        const action = a.action;
        state.friendPendingTapAction = null;
        friendResolvePendingCardAction(action, { ownHand: hand }).catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `カード対象エラー：${error.message || error}`;
        });
        return true;
      }
      if (a.type === "opponentHand") {
        if (side !== "opponent") return true;
        state.friendSelectedTargetHand = hand;
        elements.friendAttackTo.value = hand;
        const action = a.action;
        if (action?.kind === "rapidFireTarget") {
          friendResolveRapidFireTarget(hand).catch(error => {
            console.error(error);
            elements.friendLobbyMessage.textContent = `乱射対象エラー：${error.message || error}`;
          });
          return true;
        }
        state.friendPendingTapAction = null;
        friendResolvePendingCardAction(action, { enemyHand: hand }).catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `カード対象エラー：${error.message || error}`;
        });
        return true;
      }
      if (a.type === "equalOwn") {
        if (side !== "own") return true;
        state.friendSelectedOwnHand = hand;
        elements.friendAttackFrom.value = hand;
        state.friendPendingTapAction = { ...a, type: "equalOpponent", ownHand: hand };
        updateFriendGameView(state.friendRoomData?.game);
        return true;
      }
      if (a.type === "equalOpponent") {
        if (side !== "opponent") return true;
        state.friendSelectedTargetHand = hand;
        elements.friendAttackTo.value = hand;
        const action = a.action;
        const ownHand = a.ownHand;
        state.friendPendingTapAction = null;
        friendResolvePendingCardAction(action, { ownHand, enemyHand: hand }).catch(error => {
          console.error(error);
          elements.friendLobbyMessage.textContent = `カード対象エラー：${error.message || error}`;
        });
        return true;
      }
      return false;
    }


    function showFriendCardBurst(cardName, detail = "") {
      const el = elements.friendCardBurst;
      if (!el) return;
      el.innerHTML = `<strong>${cardName}</strong>${detail ? `<span>${detail}</span>` : ""}`;
      el.classList.remove("show");
      void el.offsetWidth;
      el.classList.add("show");
      window.setTimeout(() => el.classList.remove("show"), 1400);
    }

    function friendCardByName(cardName) {
      return Object.values(CARD_LIBRARY).find(card => card?.name === cardName) || null;
    }

    let friendPopupTimer = null;
    function showFriendUnifiedCardPopup(role, cardName, detail = "") {
      if (!elements.overlay || !elements.popupCard || !elements.popupUser || !elements.popupName || !elements.popupText) return;
      const card = friendCardByName(cardName);
      const isOwn = role === state.friendRole;
      const ownerLabel = isOwn ? "あなた" : "相手";

      if (friendPopupTimer) {
        clearTimeout(friendPopupTimer);
        friendPopupTimer = null;
      }

      elements.popupCard.className = "popup-card friend-card-popup";
      elements.popupUser.className = `popup-user ${isOwn ? "friend-own-user" : "friend-opponent-user"}`;
      elements.popupUser.textContent = `${ownerLabel}が使用`;
      elements.popupName.textContent = `「${cardName || "カード"}」`;
      elements.popupText.textContent = card?.text || detail || "カードが使用されました。";
      elements.overlay.classList.remove("show");
      void elements.overlay.offsetWidth;
      elements.overlay.classList.add("show");

      friendPopupTimer = window.setTimeout(() => {
        elements.overlay.classList.remove("show");
        friendPopupTimer = null;
      }, 1500);
    }


    function makeFriendFx(type, payload = {}) {
      return { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type, ...payload };
    }

    function visibleFriendHandButton(ownerRole, hand) {
      if (!state.friendRole || !ownerRole) return null;
      const isOwn = ownerRole === state.friendRole;
      if (isOwn) return hand === "L" ? elements.friendOwnLeft : elements.friendOwnRight;
      return hand === "L" ? elements.friendOpponentLeft : elements.friendOpponentRight;
    }

    function setFriendButtonDisplay(button, value) {
      if (!button) return;
      const num = button.querySelector(".fingers");
      const icons = button.querySelector(".finger-icons");
      const nextValue = value ?? 0;
      if (num) num.textContent = String(nextValue);
      if (icons) icons.textContent = "●".repeat(Math.max(0, nextValue));
      button.classList.toggle("zero", nextValue <= 0);
    }

    function animateFriendAttackFx(fx, game) {
      const source = visibleFriendHandButton(fx.attacker, fx.from);
      const target = visibleFriendHandButton(fx.defender, fx.to);
      if (source) {
        source.classList.remove("attack-source");
        void source.offsetWidth;
        source.classList.add("attack-source");
        window.setTimeout(() => source.classList.remove("attack-source"), 720);
      }
      if (target) {
        target.classList.remove("attack-target", "total-preview");
        void target.offsetWidth;
        target.classList.add("attack-target");
        if (Number(fx.total) >= 5) {
          window.setTimeout(() => {
            target.classList.add("total-preview");
            setFriendButtonDisplay(target, fx.total);
          }, 180);
          window.setTimeout(() => {
            const finalSide = game?.[fx.defender] || {};
            setFriendButtonDisplay(target, finalSide[fx.to] ?? fx.after);
            target.classList.remove("total-preview");
          }, 950);
        }
        window.setTimeout(() => target.classList.remove("attack-target"), 720);
      }
    }

    function handleFriendFx(game) {
      const fx = game?.fx;
      if (!fx || state.friendLastFxId === fx.id) return;
      state.friendLastFxId = fx.id;

      if (fx.type === "card") {
        showFriendUnifiedCardPopup(fx.role, fx.cardName || "カード", fx.detail || "");
      }
      if (fx.type === "discardEffect") {
        showFriendCardBurst(fx.cardName || "追加効果", fx.detail || "");
      }
      if (fx.type === "attack") {
        showFriendCardBurst("攻撃", `${friendRoleLabel(fx.attacker)}：${fx.from === "L" ? "左" : "右"} → ${fx.to === "L" ? "左" : "右"}`);
        animateFriendAttackFx(fx, game);
      }
    }

    function applyFriendRapidFire(game, role, bulletIndex, targetHand, logsPrefix = []) {
      const opp = friendRoleOpponent(role);
      let me = { ...game[role], hand: [...(game[role].hand || [])], deck: [...(game[role].deck || [])], discard: [...(game[role].discard || [])], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };
      let enemy = { ...game[opp], hand: [...(game[opp].hand || [])], deck: [...(game[opp].deck || [])], discard: [...(game[opp].discard || [])], attachments: { L: [...friendAttachments(game[opp] || {}, "L")], R: [...friendAttachments(game[opp] || {}, "R")] } };
      const target = targetHand || state.friendPendingRapidFire?.target;
      const logs = [...logsPrefix];
      let discardFx = null;

      if (!me.hand.length) {
        logs.push("捨てる手札がないため乱射は不発。");
        return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
      }
      if ((enemy[target] || 0) <= 0) {
        logs.push("対象が0なので乱射は不発。");
        return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
      }

      const safeIndex = Math.max(0, Math.min(me.hand.length - 1, Number(bulletIndex) || 0));
      const [bulletId] = me.hand.splice(safeIndex, 1);
      const bullet = friendCardInfo(bulletId);
      me.discard.push(bulletId);

      let damage = Number(bullet.cost) || 0;
      if (bullet.bullet) damage += 1;

      if (bulletId === "logicAtelier") {
        logs.push("ロジックアトリエ：選択中の相手の手を0にした。");
        showFriendCardBurst("ロジックアトリエ", "相手の手を0にした");
        discardFx = makeFriendFx("discardEffect", { role, cardName: "ロジックアトリエ", detail: "相手の手を0にした" });
        enemy[target] = 0;
      } else {
        damage = friendApplyGuard(enemy, target, Math.max(1, damage), logs);
        const before = enemy[target];
        const total = before + damage;
        enemy[target] = friendWrap(total);
        logs.push(`乱射：弾「${bullet.name}」を捨て、相手の${target === "L" ? "左" : "右"}に${damage}。${before}→${total}${total >= 5 ? `→${enemy[target]}` : ""}`);
      }

      if (bulletId === "accelerationBullet") {
        me = drawFriendCard({ ...game, [role]: me }, role, 1);
        logs.push("加速弾：1枚引いた。");
        showFriendCardBurst("加速弾", "1枚引いた");
        discardFx = makeFriendFx("discardEffect", { role, cardName: "加速弾", detail: "1枚引いた" });
      }

      if (bulletId === "specialBullet") {
        const result = friendDiscardRandomHandCard(enemy);
        enemy = result.side;
        logs.push(result.discarded ? `特殊弾：相手の手札「${friendCardInfo(result.discarded).name}」を捨てた。` : "特殊弾：相手の手札がなかった。");
        const detail = result.discarded ? `相手の「${friendCardInfo(result.discarded).name}」を捨てた` : "相手の手札がなかった";
        showFriendCardBurst("特殊弾", detail);
        discardFx = makeFriendFx("discardEffect", { role, cardName: "特殊弾", detail });
      }

      if (bulletId === "piercingBullet") {
        const result = friendRemoveOneAttachment(enemy, target);
        enemy = result.side;
        logs.push(result.removed ? `貫通弾：相手の設置カード「${friendCardInfo(result.removed).name}」を捨てた。` : "貫通弾：相手の設置カードがなかった。");
        const detail = result.removed ? `「${friendCardInfo(result.removed).name}」を破壊` : "設置カードなし";
        showFriendCardBurst("貫通弾", detail);
        discardFx = makeFriendFx("discardEffect", { role, cardName: "貫通弾", detail });
      }

      enemy = friendClearAttachmentsIfDead(enemy);
      const winner = friendIsDead(enemy) ? role : null;
      const nextGame = { ...game, [role]: me, [opp]: enemy, winner, fx: discardFx || makeFriendFx("card", { role, cardName: "乱射", detail: `弾「${bullet.name}」を捨てた` }), log: [...(game.log || []), ...logs, ...(winner ? [`${friendRoleLabel(role)}の勝ち。`] : [])].slice(-30) };
      return { game: winner ? nextGame : friendEndTurn(nextGame, role, []) };
    }

    async function friendChooseRapidFireAmmo(bulletIndex) {
      if (!state.friendPendingRapidFire || state.friendPendingRapidFire.stage !== "discard") return;
      const game = state.friendRoomData?.game;
      if (!friendCanAct(game)) return;
      const hand = game?.[state.friendRole]?.hand || [];
      if (!hand.length) return;
      const safeIndex = Math.max(0, Math.min(hand.length - 1, Number(bulletIndex) || 0));
      state.friendPendingRapidFire = {
        ...state.friendPendingRapidFire,
        bulletIndex: safeIndex,
        stage: "target"
      };
      state.friendPendingTapAction = { type: "opponentHand", action: { kind: "rapidFireTarget" }, label: "乱射" };
      updateFriendGameView(game);
    }

    async function friendResolveRapidFireTarget(targetHand) {
      const pending = state.friendPendingRapidFire;
      if (!pending || pending.stage !== "target" || pending.bulletIndex === null) return;
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const enemy = game?.[friendRoleOpponent(state.friendRole)] || {};
        if ((enemy[targetHand] || 0) <= 0) {
          elements.friendLobbyMessage.textContent = "乱射では0の手を対象にできません。別の手を選んでください。";
          return null;
        }
        const result = applyFriendRapidFire(game, state.friendRole, pending.bulletIndex, targetHand, []);
        state.friendPendingRapidFire = null;
        state.friendPendingTapAction = null;
        return result;
      });
    }

    async function friendCancelRapidFire() {
      if (!state.friendPendingRapidFire) return;
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        let me = { ...game[role], hand: [...(game[role].hand || [])], discard: [...(game[role].discard || [])] };
        me.hand.push("rapidFire");
        const discardIndex = me.discard.lastIndexOf("rapidFire");
        if (discardIndex >= 0) me.discard.splice(discardIndex, 1);
        me.cardPlayed = false;
        state.friendPendingRapidFire = null;
        return { game: { ...game, [role]: me, log: [...(game.log || []), `${friendRoleLabel(role)}：乱射をキャンセル。`].slice(-30) } };
      });
    }



    async function friendResolveDiscardAction(discardIndex) {
      const pending = state.friendPendingDiscardAction;
      if (!pending) return;
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        const opp = friendRoleOpponent(role);
        let me = { ...game[role], hand: [...(game[role].hand || [])], deck: [...(game[role].deck || [])], discard: [...(game[role].discard || [])], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };
        let logs = [`${friendRoleLabel(role)}：「${pending.label || friendCardInfo(pending.cardId).name}」のため手札を捨てた。`];

        if (!me.hand.length) {
          logs.push("捨てる手札がなかったため不発。");
          state.friendPendingDiscardAction = null;
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        const safeIndex = Math.max(0, Math.min(me.hand.length - 1, Number(discardIndex) || 0));
        const [discarded] = me.hand.splice(safeIndex, 1);
        me.discard.push(discarded);
        logs.push(`「${friendCardInfo(discarded).name}」を捨てた。`);

        if (pending.kind === "calm") {
          const tempGame = { ...game, [role]: me };
          me = drawFriendCard(tempGame, role, 2);
          logs.push("2枚引いた。");
          state.friendPendingDiscardAction = null;
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (pending.kind === "repair") {
          const zeroHand = pending.zeroHand;
          if (!zeroHand || me[zeroHand] !== 0) {
            logs.push("復活対象の手が0ではなくなったため不発。");
            state.friendPendingDiscardAction = null;
            return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          me[zeroHand] = 1;
          logs.push(`${zeroHand === "L" ? "左" : "右"}手を1で復活。`);
          state.friendPendingDiscardAction = null;
          return { game: friendEndTurn({ ...game, [role]: me }, role, logs) };
        }

        state.friendPendingDiscardAction = null;
        return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
      });
    }

    async function friendCancelDiscardAction() {
      const pending = state.friendPendingDiscardAction;
      if (!pending) return;
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        let me = { ...game[role], hand: [...(game[role].hand || [])], discard: [...(game[role].discard || [])] };
        me.hand.push(pending.cardId);
        const discardIndex = me.discard.lastIndexOf(pending.cardId);
        if (discardIndex >= 0) me.discard.splice(discardIndex, 1);
        me.cardPlayed = false;
        state.friendPendingDiscardAction = null;
        return { game: { ...game, [role]: me, log: [...(game.log || []), `${friendRoleLabel(role)}：「${pending.label || friendCardInfo(pending.cardId).name}」をキャンセル。`].slice(-30) } };
      });
    }

    async function friendResolvePendingCardAction(action, target) {
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        const opp = friendRoleOpponent(role);
        if (state.friendPendingTapAction || state.friendPendingRapidFire || state.friendPendingDiscardAction) {
          elements.friendLobbyMessage.textContent = "先に現在の対象選択を完了するかキャンセルしてください。";
          return null;
        }
        let me = { ...game[role], hand: [...(game[role].hand || [])], deck: [...(game[role].deck || [])], discard: [...(game[role].discard || [])], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };
        let enemy = { ...game[opp], hand: [...(game[opp].hand || [])], deck: [...(game[opp].deck || [])], discard: [...(game[opp].discard || [])], attachments: { L: [...friendAttachments(game[opp] || {}, "L")], R: [...friendAttachments(game[opp] || {}, "R")] } };
        const cardId = action.cardId;
        const card = friendCardInfo(cardId);
        const logs = [`${friendRoleLabel(role)}：「${card.name}」の対象を選択。`];

        if (action.kind === "snipe") {
          const hand = target.enemyHand;
          if ((enemy[hand] || 0) <= 0) {
            logs.push("対象が0なので不発。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          const before = enemy[hand];
          enemy[hand] = friendWrap(before + 1);
          enemy = friendClearAttachmentsIfDead(enemy);
          logs.push(`狙撃：相手の${hand === "L" ? "左" : "右"} ${before}→${enemy[hand]}。`);
          const winner = friendIsDead(enemy) ? role : null;
          const nextGame = { ...game, [role]: me, [opp]: enemy, winner, log: [...(game.log || []), ...logs, ...(winner ? [`${friendRoleLabel(role)}の勝ち。`] : [])].slice(-30) };
          return { game: winner ? nextGame : friendEndTurn(nextGame, role, []) };
        }

        if (action.kind === "randomDice") {
          const hand = target.ownHand;
          if ((me[hand] || 0) <= 0) {
            logs.push("対象が0なので不発。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          const before = me[hand];
          me[hand] = Math.floor(Math.random() * 5);
          me = friendClearAttachmentsIfDead(me);
          logs.push(`ランダムダイス：自分の${hand === "L" ? "左" : "右"} ${before}→${me[hand]}。`);
          const winner = friendIsDead(me) ? opp : null;
          return { game: { ...game, [role]: me, [opp]: enemy, winner, log: [...(game.log || []), ...logs, ...(winner ? [`${friendRoleLabel(opp)}の勝ち。`] : [])].slice(-30) } };
        }

        if (action.kind === "adjust") {
          const from = target.ownHand;
          const to = from === "L" ? "R" : "L";
          if ((me[from] || 0) <= 0) {
            logs.push("選択した手が0なので不発。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          me[from] -= 1;
          me[to] = friendWrap((me[to] || 0) + 1);
          me = friendClearAttachmentsIfDead(me);
          logs.push(`整える：自分の${from === "L" ? "左" : "右"}からもう片方へ1本移した。`);
          const winner = friendIsDead(me) ? opp : null;
          return { game: { ...game, [role]: me, [opp]: enemy, winner, log: [...(game.log || []), ...logs, ...(winner ? [`${friendRoleLabel(opp)}の勝ち。`] : [])].slice(-30) } };
        }

        if (action.kind === "equalTrade") {
          const ownHand = target.ownHand;
          const enemyHand = target.enemyHand;
          if ((me[ownHand] || 0) <= 0 || (enemy[enemyHand] || 0) < 2) {
            logs.push("条件を満たさないため不発。自分は1以上、相手は2以上が必要。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          me[ownHand] -= 1;
          enemy[enemyHand] -= 1;
          me = friendClearAttachmentsIfDead(me);
          enemy = friendClearAttachmentsIfDead(enemy);
          logs.push("等価交換：選択した自分の手と相手の手を-1。");
          const winner = friendIsDead(enemy) ? role : friendIsDead(me) ? opp : null;
          const nextGame = { ...game, [role]: me, [opp]: enemy, winner, log: [...(game.log || []), ...logs, ...(winner ? [`${friendRoleLabel(winner)}の勝ち。`] : [])].slice(-30) };
          return { game: winner ? nextGame : nextGame };
        }

        if (action.kind === "blessing") {
          const hand = target.ownHand;
          if (!friendCanAddAttachment(me, hand, cardId)) {
            logs.push("その手には加護を置けません。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          me = friendAddAttachment(me, hand, cardId);
          logs.push(`${hand === "L" ? "左" : "右"}手に「${card.name}」を置いた。`);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (action.kind === "curse") {
          const hand = target.enemyHand;
          if (!friendCanAddAttachment(enemy, hand, cardId)) {
            logs.push("その相手の手には呪縛を置けません。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          enemy = friendAddAttachment(enemy, hand, cardId);
          logs.push(`相手の${hand === "L" ? "左" : "右"}手に「${card.name}」を置いた。`);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        return null;
      });
    }

    async function friendUseCardAction(index) {
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        const opp = friendRoleOpponent(role);
        if (state.friendPendingTapAction || state.friendPendingRapidFire || state.friendPendingDiscardAction) {
          elements.friendLobbyMessage.textContent = "先に現在の対象選択を完了するかキャンセルしてください。";
          return null;
        }
        let me = { ...game[role], hand: [...(game[role].hand || [])], deck: [...(game[role].deck || [])], discard: [...(game[role].discard || [])], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };
        let enemy = { ...game[opp], hand: [...(game[opp].hand || [])], deck: [...(game[opp].deck || [])], discard: [...(game[opp].discard || [])], attachments: { L: [...friendAttachments(game[opp] || {}, "L")], R: [...friendAttachments(game[opp] || {}, "R")] } };
        if (me.cardPlayed) {
          elements.friendLobbyMessage.textContent = "このターンはすでにカードを使っています。";
          return null;
        }
        const cardId = me.hand[index];
        const card = friendCardInfo(cardId);
        if (me.costLimit !== null && me.costLimit !== undefined && Number(card.cost) > Number(me.costLimit)) {
          elements.friendLobbyMessage.textContent = `倹約令中です。コスト${me.costLimit}以下のカードしか使えません。`;
          return null;
        }
        if (!FRIEND_SIMPLE_LIBRARY[cardId]) {
          me.hand.splice(index, 1);
          me.discard.push(cardId);
          me.cardPlayed = true;
          return { game: { ...game, [role]: me, log: [...(game.log || []), `${friendRoleLabel(role)}：未対応カード「${card.name}」を捨てました。`].slice(-30) } };
        }
        me.hand.splice(index, 1);
        me.discard.push(cardId);
        me.cardPlayed = true;
        let logs = [`${friendRoleLabel(role)}：「${card.name}」を使用。`];

        if (cardId === "insight" || cardId === "nekodamashi") {
          let tempGame = { ...game, [role]: me };
          tempGame[role] = drawFriendCard(tempGame, role, 1);
          logs.push("1枚引いた。");
          return { game: { ...game, [role]: tempGame[role], log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "calm") {
          if (me.hand.length <= 0) {
            logs.push("追加で捨てる手札がないため、1枚だけ引いた。");
            let tempGame = { ...game, [role]: me };
            tempGame[role] = drawFriendCard(tempGame, role, 1);
            return { game: { ...game, [role]: tempGame[role], log: [...(game.log || []), ...logs].slice(-30) } };
          }
          state.friendPendingDiscardAction = { kind: "calm", cardId, label: "落ち着ける" };
          logs.push("落ち着ける：捨てるカードを手札からタップしてください。");
          setTimeout(() => renderFriendHandCards({ ...game, [role]: me, [opp]: enemy }), 0);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "strongHit") {
          me.attackBonus = (me.attackBonus || 0) + 1;
          logs.push("このターン次の攻撃+1。");
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "lightHit") {
          me.attackBonus = (me.attackBonus || 0) - 1;
          logs.push("このターン次の攻撃-1。");
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "lockSplit") {
          enemy.noSplit = true;
          logs.push("次の相手ターン、相手は分ける不可。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "preparation") {
          const result = takeCardFromDeck(me, id => ["insight", "strongHit", "lightHit", "adjust", "equalTrade", "calm"].includes(id));
          me.deck = result.side.deck;
          me.hand = result.side.hand;
          logs.push(result.found ? `山札から「${FRIEND_SIMPLE_LIBRARY[result.found].name}」を手札へ。` : "対象カードが山札になかった。");
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "bulletSupply") {
          const result = takeCardFromDeck(me, id => !!friendCardInfo(id).bullet);
          me.deck = result.side.deck;
          me.hand = result.side.hand;
          logs.push(result.found ? `山札から弾「${friendCardInfo(result.found).name}」を手札へ。` : "弾カードが山札になかった。");
          return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "randomDice") {
          friendSetPendingTapAction({ type: "ownHand", action: { kind: "randomDice", cardId }, label: "ランダムダイス" });
          logs.push("ランダムダイス：対象にする自分の手をタップしてください。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "equalTrade") {
          friendSetPendingTapAction({ type: "equalOwn", action: { kind: "equalTrade", cardId }, label: "等価交換" });
          logs.push("等価交換：まず自分の手をタップしてください。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "adjust") {
          friendSetPendingTapAction({ type: "ownHand", action: { kind: "adjust", cardId }, label: "整える" });
          logs.push("整える：1本移す元の自分の手をタップしてください。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "repair") {
          const zeroHand = me.L === 0 ? "L" : me.R === 0 ? "R" : null;
          if (!zeroHand) {
            logs.push("0の手がないため不発。");
            return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          if (me.hand.length <= 0) {
            logs.push("追加で捨てる手札がないため不発。");
            return { game: { ...game, [role]: me, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          state.friendPendingDiscardAction = { kind: "repair", cardId, label: "補修", zeroHand };
          logs.push(`補修：捨てるカードを手札からタップしてください。対象は${zeroHand === "L" ? "左" : "右"}手。`);
          setTimeout(() => renderFriendHandCards({ ...game, [role]: me, [opp]: enemy }), 0);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "rapidFire") {
          if (!me.hand.length) {
            logs.push("捨てる手札がないため不発。");
            return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
          }
          state.friendPendingRapidFire = { role, bulletIndex: null, target: null, stage: "discard" };
          logs.push("乱射：まず弾薬として捨てるカードを手札からタップしてください。");
          setTimeout(() => renderFriendHandCards({ ...game, [role]: me, [opp]: enemy }), 0);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (card.type === "blessing") {
          friendSetPendingTapAction({ type: "ownHand", action: { kind: "blessing", cardId }, label: card.name });
          logs.push(`${card.name}：置く自分の手をタップしてください。`);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (card.type === "curse") {
          friendSetPendingTapAction({ type: "opponentHand", action: { kind: "curse", cardId }, label: card.name });
          logs.push(`${card.name}：置く相手の手をタップしてください。`);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "scout") {
          logs.push(`相手の手札は${enemy.hand.length}枚。`);
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "costLimit") {
          enemy.costLimit = 2;
          logs.push("次の相手ターン、相手はコスト2以下のカードしか使えない。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "doubleDouble") {
          if (me.L === 2 && me.R === 2) {
            me.extraAction = true;
            logs.push("2-2なので、次の攻撃/分ける後に追加行動できる。");
          } else {
            logs.push("自分が2-2ではないため不発。");
          }
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "overAccel") {
          me.extraDrawNext = (me.extraDrawNext || 0) + 1;
          logs.push("次の自分ターン開始時、追加で1枚引く。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "breakthrough") {
          me.attackBonus = (me.attackBonus || 0) + 1;
          logs.push("簡易版：このターン次の攻撃+1。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "focusShot") {
          const result = takeCardFromDeckOrDiscard(me, id => id === "snipe");
          me.deck = result.side.deck;
          me.discard = result.side.discard;
          me.hand = result.side.hand;
          logs.push(result.found ? "山札/捨て札から「狙撃」を手札へ。" : "狙撃が見つからなかった。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "reload") {
          const result = takeCardFromDiscard(me, id => id === "snipe");
          me.discard = result.side.discard;
          me.hand = result.side.hand;
          logs.push(result.found ? "捨て札から「狙撃」を手札へ。" : "捨て札に狙撃がなかった。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (cardId === "passCard") {
          return { game: friendEndTurn({ ...game, [role]: me }, role, logs) };
        }

        if (cardId === "snipe") {
          friendSetPendingTapAction({ type: "opponentHand", action: { kind: "snipe", cardId }, label: "狙撃" });
          logs.push("狙撃：攻撃したい相手の手をタップしてください。");
          return { game: { ...game, [role]: me, [opp]: enemy, log: [...(game.log || []), ...logs].slice(-30) } };
        }

        if (me.noSplit) {
          elements.friendLobbyMessage.textContent = "固定の効果で、このターンは分けられません。";
          return null;
        }

        const left = Math.max(0, Math.min(4, Number(elements.friendSplitLeft.value) || 0));
        const right = Math.max(0, Math.min(4, Number(elements.friendSplitRight.value) || 0));

        if (left <= 0 || right <= 0) {
          elements.friendLobbyMessage.textContent = "通常の分けるでは片手0にできません。";
          return null;
        }
        if (left === me.L && right === me.R) {
          elements.friendLobbyMessage.textContent = "同じ形には分けられません。";
          return null;
        }
        if (left + right !== me.L + me.R) {
          elements.friendLobbyMessage.textContent = "左右の合計が変わらないようにしてください。";
          return null;
        }

        const nextLog = [...(game.log || []), `${friendRoleLabel(role)}：分ける。${me.L}-${me.R} → ${left}-${right}`].slice(-30);
        me.L = left;
        me.R = right;
        me.noSplit = false;
        const nextGame = {
          ...game,
          [role]: me,
          log: nextLog
        };
        return { game: friendEndTurn(nextGame, role, []) };
      });
    }


    async function friendAttackAction(fromOverride = null, toOverride = null) {
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        const opp = friendRoleOpponent(role);
        const from = fromOverride || elements.friendAttackFrom.value;
        const to = toOverride || elements.friendAttackTo.value;
        let me = { ...game[role], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };
        let enemy = { ...game[opp], attachments: { L: [...friendAttachments(game[opp] || {}, "L")], R: [...friendAttachments(game[opp] || {}, "R")] } };
        if ((me[from] || 0) <= 0 || (enemy[to] || 0) <= 0) return null;

        const logs = [];
        const basePower = me[from];
        let bonus = me.attackBonus || 0;
        if (friendHasAttachment(me, from, "powerBlessing")) {
          bonus += 1;
          logs.push("力の加護：攻撃+1。");
        }
        if (friendHasAttachment(me, from, "slowCurse")) {
          bonus -= 1;
          logs.push("鈍重の呪縛：攻撃-1。");
        }
        if (friendHasAttachment(me, from, "immutableCurse") && bonus > 0) {
          logs.push("不変の呪縛：攻撃増加を無効化。");
          bonus = Math.min(0, bonus);
        }
        let power = Math.max(1, basePower + bonus);
        power = friendApplyGuard(enemy, to, power, logs);

        const before = enemy[to];
        const total = before + power;
        enemy[to] = friendWrap(total);
        me.attackBonus = 0;

        let afterAttackDraw = false;
        if (friendHasAttachment(me, from, "growthBlessing") && total === 5) {
          afterAttackDraw = true;
          logs.push("成長：ちょうど5にしたので1枚引く。");
        }

        enemy = friendClearAttachmentsIfDead(enemy);
        me = friendClearAttachmentsIfDead(me);
        if (afterAttackDraw) me = drawFriendCard({ ...game, [role]: me }, role, 1);

        const nextLog = [...(game.log || []), ...logs, `${friendRoleLabel(role)}：${from === "L" ? "左" : "右"}${basePower}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ""}で相手の${to === "L" ? "左" : "右"}を攻撃。${before}→${total}${total >= 5 ? `→${enemy[to]}` : ""}`].slice(-30);
        const winner = friendIsDead(enemy) ? role : null;
        const attackFx = makeFriendFx("attack", {
          attacker: role,
          defender: opp,
          from,
          to,
          before,
          total,
          after: enemy[to],
          power
        });
        const nextGame = {
          ...game,
          [role]: me,
          [opp]: enemy,
          winner,
          fx: attackFx,
          log: winner ? [...nextLog, `${friendRoleLabel(role)}の勝ち。`].slice(-30) : nextLog
        };
        return { game: winner ? nextGame : friendEndTurn(nextGame, role, []) };
      });
    }

    async function friendSplitAction() {
      await updateFriendGame((data) => {
        const game = data.game;
        if (!friendCanAct(game)) return null;
        const role = state.friendRole;
        let me = { ...game[role], attachments: { L: [...friendAttachments(game[role] || {}, "L")], R: [...friendAttachments(game[role] || {}, "R")] } };

        if (me.noSplit) {
          elements.friendLobbyMessage.textContent = "固定の効果で、このターンは分けられません。";
          return null;
        }

        const left = Math.max(0, Math.min(4, Number(elements.friendSplitLeft.value) || 0));
        const right = Math.max(0, Math.min(4, Number(elements.friendSplitRight.value) || 0));

        if (left <= 0 || right <= 0) {
          elements.friendLobbyMessage.textContent = "通常の分けるでは片手0にできません。";
          return null;
        }
        if (left === me.L && right === me.R) {
          elements.friendLobbyMessage.textContent = "同じ形には分けられません。";
          return null;
        }
        if (left + right !== me.L + me.R) {
          elements.friendLobbyMessage.textContent = "左右の合計が変わらないようにしてください。";
          return null;
        }

        const nextLog = [...(game.log || []), `${friendRoleLabel(role)}：分ける。${me.L}-${me.R} → ${left}-${right}`].slice(-30);
        me.L = left;
        me.R = right;
        me.noSplit = false;
        const nextGame = {
          ...game,
          [role]: me,
          log: nextLog
        };
        return { game: friendEndTurn(nextGame, role, []) };
      });
    }

    function updateFriendLobbyView(data = state.friendRoomData) {
      const role = state.friendRole;
      const roleLabel = role === "host" ? "あなた：ホスト" : role === "guest" ? "あなた：ゲスト" : "あなた：未入室";
      if (!state.friendRoomId) {
        elements.roomStatusText.textContent = "未接続";
        elements.roomPlayersText.textContent = "あなた：未入室 / 相手：未入室";
        elements.friendReadyText.textContent = "2人が入室して準備完了すると「試合開始できます」と表示されます。";
        elements.friendReadyBtn.disabled = true;
        elements.friendUnreadyBtn.disabled = true;
        updateFriendGameView(null);
        return;
      }

      const hostJoined = !!data?.hostJoined;
      const guestJoined = !!data?.guestJoined;
      const hostReady = !!data?.hostReady;
      const guestReady = !!data?.guestReady;
      const bothJoined = hostJoined && guestJoined;
      const bothReady = bothJoined && hostReady && guestReady;

      elements.roomStatusText.textContent = `部屋ID：${state.friendRoomId} / 状態：${data?.status || "接続中"}`;
      elements.roomPlayersText.textContent =
        `ホスト：${hostJoined ? "入室済み" : "待機中"}${hostReady ? "・準備完了" : ""} / ` +
        `ゲスト：${guestJoined ? "入室済み" : "待機中"}${guestReady ? "・準備完了" : ""} / ${roleLabel}`;

      elements.friendReadyBtn.disabled = !bothJoined || (role === "host" ? hostReady : guestReady);
      elements.friendUnreadyBtn.disabled = !(role === "host" ? hostReady : guestReady);

      if (!bothJoined) {
        elements.friendReadyText.textContent = role === "host"
          ? "相手の入室を待っています。部屋URLを友達に送ってください。"
          : "ホスト側の入室情報を確認中です。";
      } else if (bothReady) {
        elements.friendReadyText.textContent = data?.game?.started ? "簡易試合中です。" : "2人とも準備完了です。ホストが簡易試合を開始できます。";
      } else {
        elements.friendReadyText.textContent = "2人そろいました。準備完了を押してください。";
      }

      updateFriendGameView(data?.game);
    }

    function subscribeFriendRoom(roomId) {
      const fb = firebaseApi();
      if (!fb) {
        elements.friendLobbyMessage.textContent = "Firebaseの読み込みがまだ完了していません。数秒待ってもう一度試してください。";
        return;
      }
      if (state.friendUnsubscribe) {
        state.friendUnsubscribe();
        state.friendUnsubscribe = null;
      }
      const roomRef = fb.doc(fb.db, "rooms", roomId);
      state.friendUnsubscribe = fb.onSnapshot(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
          elements.friendLobbyMessage.textContent = "この部屋はまだ作成されていません。ホストが部屋を作る必要があります。";
          state.friendRoomData = null;
          updateFriendLobbyView(null);
          return;
        }
        const data = snapshot.data();
        state.friendRoomData = data;
        elements.friendLobbyMessage.textContent = "Firebaseと同期中です。別タブや友達の端末で入室すると、この表示が更新されます。";
        updateFriendLobbyView(data);
      }, (error) => {
        console.error(error);
        elements.friendLobbyMessage.textContent = `Firebase同期エラー：${error.message || error}`;
      });
      startFriendRoomPolling(roomId);
    }

    
    function startFriendRoomPolling(roomId) {
      const fb = firebaseApi();
      if (!fb || !roomId) return;
      if (state.friendPollTimer) {
        window.clearInterval(state.friendPollTimer);
        state.friendPollTimer = null;
      }
      state.friendPollTimer = window.setInterval(async () => {
        if (!state.friendRoomId || state.friendRoomId !== roomId) return;
        if (!["friendLobby", "friendBattle"].includes(state.currentScreen)) return;
        try {
          const roomRef = fb.doc(fb.db, "rooms", roomId);
          const snapshot = await fb.getDoc(roomRef);
          if (snapshot.exists()) {
            const data = snapshot.data();
            state.friendRoomData = data;
            updateFriendLobbyView(data);
          }
        } catch (error) {
          console.warn("poll failed", error);
        }
      }, 2500);
    }

async function createFriendRoom() {
      const fb = firebaseApi();
      if (!fb) {
        elements.friendLobbyMessage.textContent = "Firebaseの読み込み中です。数秒待ってからもう一度押してください。";
        return;
      }
      const roomId = makeRoomId();
      setFriendRoomUi(roomId, "host");
      const roomRef = fb.doc(fb.db, "rooms", roomId);
      await fb.setDoc(roomRef, {
        createdAt: fb.serverTimestamp(),
        updatedAt: fb.serverTimestamp(),
        status: "waiting",
        hostJoined: true,
        guestJoined: false,
        hostReady: false,
        guestReady: false,
        hostLastSeen: fb.serverTimestamp()
      });
      elements.friendLobbyMessage.textContent = "Firebaseに部屋を作成しました。URLをコピーして友達に送ってください。";
      subscribeFriendRoom(roomId);
      updateFriendLobbyView({ hostJoined: true, guestJoined: false, hostReady: false, guestReady: false, status: "waiting" });
    }

    async function joinFriendRoom(roomIdRaw) {
      const fb = firebaseApi();
      if (!fb) {
        elements.friendLobbyMessage.textContent = "Firebaseの読み込み中です。数秒待ってからもう一度押してください。";
        return;
      }
      const roomId = extractRoomId(roomIdRaw);
      if (!roomId) {
        elements.friendLobbyMessage.textContent = "部屋IDかURLを入力してください。";
        return;
      }

      const roomRef = fb.doc(fb.db, "rooms", roomId);
      const snapshot = await fb.getDoc(roomRef);
      if (!snapshot.exists()) {
        elements.friendLobbyMessage.textContent = "その部屋IDはまだ存在しません。ホストが部屋を作ってから入ってください。";
        return;
      }

      setFriendRoomUi(roomId, "guest");
      await fb.setDoc(roomRef, {
        updatedAt: fb.serverTimestamp(),
        guestJoined: true,
        guestReady: false,
        guestLastSeen: fb.serverTimestamp(),
        status: "waiting"
      }, { merge: true });
      elements.friendLobbyMessage.textContent = "Firebase上の部屋に入室しました。";
      subscribeFriendRoom(roomId);
    }

    async function setFriendReady(ready) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId || !state.friendRole) return;
      if (!state.onlineDeckCounts) state.onlineDeckCounts = loadOnlineDeckCounts();
      if (ready && !onlineDeckIsValid(state.onlineDeckCounts)) {
        elements.friendLobbyMessage.textContent = "PVPデッキが条件を満たしていません。オンラインメニューからPVP用デッキ編集を確認してください。";
        return;
      }
      const key = state.friendRole === "host" ? "hostReady" : "guestReady";
      const deckKey = state.friendRole === "host" ? "hostDeck" : "guestDeck";
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.setDoc(roomRef, {
        [key]: ready,
        [deckKey]: onlineDeckListFromCounts(state.onlineDeckCounts),
        updatedAt: fb.serverTimestamp(),
        status: ready ? "ready-check" : "waiting"
      }, { merge: true });
    }

    function loadRoomFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");
      if (roomId) {
        setFriendRoomUi(roomId, "guest");
        showScreen("friendLobby");
        if (firebaseApi()) joinFriendRoom(roomId);
        else window.addEventListener("waribashi-firebase-ready", () => joinFriendRoom(roomId), { once: true });
      }
    }

    function showScreen(screen) {
      state.currentScreen = screen;
      const showModeMenu = screen === "modeMenu";
      const showMenu = screen === "menu";
      const showOnlineMenu = screen === "onlineMenu";
      const showOnlineDeck = screen === "onlineDeck";
      const showBattleSelect = screen === "battleSelect";
      const showFriendLobby = screen === "friendLobby";
      const showFriendBattle = screen === "friendBattle";
      const showDifficulty = screen === "difficulty";
      const showSettings = screen === "settings";
      const showDeck = screen === "deck";
      const showBattle = screen === "battle";

      elements.modeMenuScreen.classList.toggle("screen-hidden", !showModeMenu);
      elements.menuScreen.classList.toggle("screen-hidden", !showMenu);
      elements.onlineMenuScreen.classList.toggle("screen-hidden", !showOnlineMenu);
      elements.onlineDeckScreen.classList.toggle("screen-hidden", !showOnlineDeck);
      elements.battleSelectScreen.classList.toggle("screen-hidden", !showBattleSelect);
      elements.friendLobbyScreen.classList.toggle("screen-hidden", !showFriendLobby);
      elements.friendBattleScreen.classList.toggle("screen-hidden", !showFriendBattle);
      elements.difficultyScreen.classList.toggle("screen-hidden", !showDifficulty);
      elements.settingsScreen.classList.toggle("screen-hidden", !showSettings);
      elements.deckEditorScreen.classList.toggle("screen-hidden", !showDeck);
      document.querySelectorAll(".battle-screen").forEach(el => {
        el.classList.toggle("screen-hidden", !showBattle);
      });

      document.body.classList.toggle("deck-mode", showDeck);
      document.body.classList.toggle("battle-mode", showBattle);

      if (showDeck) {
        elements.deckPanel.classList.add("show");
        elements.deckBottomBar.classList.remove("hidden");
        renderDeckBuilder();
        setMessage("デッキ編集画面です。対戦を始める場合はメニューからスタートを選んでください。");
      } else {
        elements.deckBottomBar.classList.add("hidden");
      }

      if (showOnlineDeck) {
        renderOnlineDeckEditor();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function startBattleWithDifficulty(difficulty) {
      if (!areBothDecksValid()) {
        const h = getDeckStats("human");
        const c = getDeckStats("cpu");
        showScreen("deck");
        if (h.count < DECK_MIN_COUNT || c.count < DECK_MIN_COUNT) setMessage(`対戦前に、あなた用・CPU用の両方を最低${DECK_MIN_COUNT}枚以上にしてください。`);
        else if (h.count > DECK_MAX_COUNT || c.count > DECK_MAX_COUNT) setMessage(`対戦前に、あなた用・CPU用の両方を${DECK_MAX_COUNT}枚以内にしてください。`);
        else setMessage("対戦前に、あなた用・CPU用のどちらかのコストを40以内にしてください。");
        return;
      }
      state.battleMode = "cpu";
      state.cpuDifficulty = difficulty;
      elements.cpuDifficultySelect.value = difficulty;
      showScreen("battle");
      resetGame();
      const labels = { easy: "やさしめ", standard: "標準", hard: "強め" };
      setMessage(`CPU難易度「${labels[difficulty]}」で試合開始です。攻撃する手を選んでください。`);
    }

function wrapFinger(value) {
      return value % 5;
    }

    function normalize(value, player = null, hand = null) {
      if (value >= 5) {
        if (player && hand && hasAttachment(player, hand, "overflowCurse")) {
          return 0;
        }
        if (player && state.temp[player].guard) {
          state.temp[player].guard = false;
          return 4;
        }
        return wrapFinger(value);
      }
      return value;
    }

    function otherHand(hand) {
      return hand === "L" ? "R" : "L";
    }

    function isAlive(player, hand) {
      return state[player][hand] > 0;
    }

    function isDead(player) {
      return state[player].L === 0 && state[player].R === 0;
    }

    function addLog(text) {
      state.log.unshift(text);
      state.log = state.log.slice(0, 60);
    }

    function setMessage(text) {
      if (elements.message) elements.message.textContent = text;
      if (elements.deckEditorMessage) elements.deckEditorMessage.textContent = text;
    }

    function handEl(player, hand) {
      return document.getElementById(`${player}${hand}`);
    }

    function clearHighlights() {
      document.querySelectorAll(".hand").forEach(el => {
        el.classList.remove("cpu-selected", "hit-target", "calculating");
      });
      document.querySelectorAll(".calc-badge").forEach(el => {
        el.textContent = "";
      });
    }

    async function animateAttackIntent(attacker, attackHand, defender, targetHand) {
      clearHighlights();

      handEl(attacker, attackHand).classList.add(attacker === "cpu" ? "cpu-selected" : "selected");
      setMessage(`${handNames[attacker]}が攻撃する手を選びました。`);
      await delay(attacker === "cpu" ? 550 : 250);

      handEl(defender, targetHand).classList.add("hit-target");
      setMessage(`${handNames[defender]}の${handNames[targetHand]}を攻撃。`);
      await delay(attacker === "cpu" ? 600 : 360);
    }

    async function animateCalculation(defender, targetHand, total, finalValue) {
      const target = handEl(defender, targetHand);
      target.classList.remove("hit-target");
      target.classList.add("calculating");
      document.getElementById(`${defender}${targetHand}Num`).textContent = total;
      document.getElementById(`${defender}${targetHand}Icons`).textContent = "☝".repeat(Math.min(total, 9));
      document.getElementById(`${defender}${targetHand}Calc`).textContent = total >= 5 ? `→ ${finalValue}` : "";
      await delay(total >= 5 ? 650 : 300);
      clearHighlights();
    }

    function currentDeckCounts(owner = state.editingDeckOwner) {
      if (!state.deckCounts[owner]) state.deckCounts[owner] = { ...DEFAULT_DECK_COUNTS };
      return state.deckCounts[owner];
    }

    function buildDeckFromCounts(owner = "human") {
      const deck = [];
      const counts = currentDeckCounts(owner);
      for (const [cardId, count] of Object.entries(counts)) {
        for (let i = 0; i < count; i++) deck.push(cardId);
      }
      return deck;
    }

    function getDeckStats(owner = state.editingDeckOwner) {
      let count = 0;
      let cost = 0;
      const counts = currentDeckCounts(owner);
      for (const [cardId, qty] of Object.entries(counts)) {
        count += qty;
        cost += (CARD_LIBRARY[cardId].cost || 0) * qty;
      }
      return { count, cost };
    }

    function isDeckValid(owner = state.editingDeckOwner) {
      const stats = getDeckStats(owner);
      return stats.count >= DECK_MIN_COUNT && stats.count <= DECK_MAX_COUNT && stats.cost <= state.costLimit;
    }

    function areBothDecksValid() {
      return isDeckValid("human") && isDeckValid("cpu");
    }

    function saveDecks() {
      const data = {
        version: 12,
        costLimit: state.costLimit,
        cpuDifficulty: state.cpuDifficulty,
        deckCounts: state.deckCounts
      };
      localStorage.setItem("waribashiDecksV11", JSON.stringify(data));
      setMessage("あなた用・CPU用デッキを保存しました。");
    }

    function loadDecks() {
      const raw = localStorage.getItem("waribashiDecksV11");
      if (!raw) {
        setMessage("保存済みデッキがありません。");
        return;
      }
      try {
        const data = JSON.parse(raw);
        if (data.deckCounts?.human && data.deckCounts?.cpu) {
          state.deckCounts = {
            human: { ...DEFAULT_DECK_COUNTS, ...data.deckCounts.human },
            cpu: { ...DEFAULT_DECK_COUNTS, ...data.deckCounts.cpu }
          };
        }
        if (Number.isFinite(Number(data.costLimit))) state.costLimit = Math.min(40, Number(data.costLimit));
        if (["easy", "standard", "hard"].includes(data.cpuDifficulty)) state.cpuDifficulty = data.cpuDifficulty;
        renderDeckBuilder();
        setMessage("保存済みデッキを読み込みました。反映するにはリスタートしてください。");
      } catch (error) {
        setMessage("保存データを読み込めませんでした。");
      }
    }

    const DECK_CODE_PREFIX = "WBDECK1:";

    function cloneValidDeckCounts(counts) {
      const fixed = {};
      for (const cardId of Object.keys(CARD_LIBRARY)) {
        if (CARD_LIBRARY[cardId].token) continue;
        const raw = counts && Object.prototype.hasOwnProperty.call(counts, cardId) ? Number(counts[cardId]) : 0;
        const value = Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.floor(raw))) : 0;
        fixed[cardId] = value;
      }
      return fixed;
    }

    function statsForCounts(counts) {
      let count = 0;
      let cost = 0;
      for (const [cardId, qty] of Object.entries(cloneValidDeckCounts(counts))) {
        count += qty;
        cost += (CARD_LIBRARY[cardId].cost || 0) * qty;
      }
      return { count, cost };
    }

    function validateCountsForImport(counts) {
      const fixed = cloneValidDeckCounts(counts);
      const stats = statsForCounts(fixed);
      if (stats.count < DECK_MIN_COUNT) {
        return { ok: false, reason: `デッキは最低${DECK_MIN_COUNT}枚必要です。`, counts: fixed, stats };
      }
      if (stats.count > DECK_MAX_COUNT) {
        return { ok: false, reason: `デッキは${DECK_MAX_COUNT}枚以内にしてください。`, counts: fixed, stats };
      }
      if (stats.cost > state.costLimit) {
        return { ok: false, reason: `合計コストが上限を超えています。${stats.cost} / ${state.costLimit}`, counts: fixed, stats };
      }
      return { ok: true, counts: fixed, stats };
    }

    function encodeDeckPayload(payload) {
      const json = JSON.stringify(payload);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      return DECK_CODE_PREFIX + base64;
    }

    function decodeDeckPayload(code) {
      const trimmed = String(code || "").trim();
      if (!trimmed.startsWith(DECK_CODE_PREFIX)) {
        throw new Error("prefix");
      }
      const base64 = trimmed.slice(DECK_CODE_PREFIX.length).replace(/\s+/g, "");
      const json = decodeURIComponent(escape(atob(base64)));
      const payload = JSON.parse(json);
      if (!payload || payload.version !== 1) {
        throw new Error("version");
      }
      return payload;
    }

    function makeCurrentDeckCode() {
      const owner = state.editingDeckOwner;
      return encodeDeckPayload({
        version: 1,
        kind: "single",
        owner,
        costLimit: state.costLimit,
        deck: cloneValidDeckCounts(currentDeckCounts(owner))
      });
    }

    function makeBothDecksCode() {
      return encodeDeckPayload({
        version: 1,
        kind: "both",
        costLimit: state.costLimit,
        decks: {
          human: cloneValidDeckCounts(state.deckCounts.human),
          cpu: cloneValidDeckCounts(state.deckCounts.cpu)
        }
      });
    }

    function exportCurrentDeckCode() {
      elements.deckCodeBox.value = makeCurrentDeckCode();
      elements.deckCodeBox.focus();
      elements.deckCodeBox.select();
      setMessage(`${state.editingDeckOwner === "human" ? "あなた用" : "CPU用"}デッキのコードを発行しました。`);
    }

    function exportBothDecksCode() {
      elements.deckCodeBox.value = makeBothDecksCode();
      elements.deckCodeBox.focus();
      elements.deckCodeBox.select();
      setMessage("あなた用・CPU用まとめデッキコードを発行しました。");
    }

    async function copyDeckCode() {
      const code = elements.deckCodeBox.value.trim();
      if (!code) {
        setMessage("コピーするデッキコードがありません。");
        return;
      }
      try {
        await navigator.clipboard.writeText(code);
        setMessage("デッキコードをコピーしました。");
      } catch (error) {
        elements.deckCodeBox.focus();
        elements.deckCodeBox.select();
        setMessage("自動コピーできませんでした。コード欄を選択したので手動でコピーしてください。");
      }
    }

    function importSingleDeck(deck, target) {
      const validation = validateCountsForImport(deck);
      if (!validation.ok) {
        setMessage(`読み込み失敗：${validation.reason}`);
        return false;
      }

      if (target === "both") {
        state.deckCounts.human = { ...validation.counts };
        state.deckCounts.cpu = { ...validation.counts };
      } else {
        const owner = target === "editing" ? state.editingDeckOwner : target;
        state.deckCounts[owner] = { ...validation.counts };
        state.editingDeckOwner = owner;
      }
      return true;
    }

    function importDeckCode() {
      try {
        const payload = decodeDeckPayload(elements.deckCodeBox.value);
        if (Number.isFinite(Number(payload.costLimit))) {
          state.costLimit = Math.min(40, Math.max(1, Math.floor(Number(payload.costLimit))));
        }

        const target = elements.deckCodeTargetSelect.value;

        if (payload.kind === "single") {
          const actualTarget = target === "auto"
            ? (payload.owner === "cpu" ? "cpu" : "human")
            : target;
          if (!importSingleDeck(payload.deck, actualTarget)) return;
          renderDeckBuilder();
          setMessage("デッキコードを読み込みました。反映するにはリスタートしてください。");
          return;
        }

        if (payload.kind === "both") {
          if (!payload.decks?.human || !payload.decks?.cpu) throw new Error("both");

          if (target === "human" || target === "cpu" || target === "editing") {
            const owner = target === "editing" ? state.editingDeckOwner : target;
            const sourceDeck = payload.decks[owner] || payload.decks.human;
            if (!importSingleDeck(sourceDeck, owner)) return;
          } else if (target === "both" || target === "auto") {
            const humanCheck = validateCountsForImport(payload.decks.human);
            const cpuCheck = validateCountsForImport(payload.decks.cpu);
            if (!humanCheck.ok) {
              setMessage(`あなた用の読み込み失敗：${humanCheck.reason}`);
              return;
            }
            if (!cpuCheck.ok) {
              setMessage(`CPU用の読み込み失敗：${cpuCheck.reason}`);
              return;
            }
            state.deckCounts.human = { ...humanCheck.counts };
            state.deckCounts.cpu = { ...cpuCheck.counts };
          } else {
            throw new Error("target");
          }

          renderDeckBuilder();
          setMessage("まとめデッキコードを読み込みました。反映するにはリスタートしてください。");
          return;
        }

        throw new Error("kind");
      } catch (error) {
        setMessage("デッキコードを読み込めませんでした。コードが壊れているか、対応していない形式です。");
      }
    }

    function renderDeckBuilder() {
      const owner = state.editingDeckOwner;
      const counts = currentDeckCounts(owner);
      elements.deckGrid.innerHTML = "";
      Object.keys(CARD_LIBRARY).forEach(cardId => {
        const card = CARD_LIBRARY[cardId];
        if (card.token) return;
        const count = counts[cardId] || 0;
        const row = document.createElement("div");
        row.className = "deck-row" + (card.blessing ? " blessing-card" : card.curse ? " curse-card" : "");
        row.innerHTML = `
          <div>
            <div class="card-title">
              <span class="deck-card-name">${escapeHtml(card.name)}</span>
              <span class="card-type${card.trap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
            </div>
            <div class="card-cost">コスト ${card.cost}</div>
            <div class="deck-card-desc">${escapeHtml(card.text)}</div>
          </div>
          <div class="count-control">
            <button class="secondary" data-action="minus" data-card="${cardId}">−</button>
            <span class="count-num">${count}</span>
            <button data-action="plus" data-card="${cardId}">＋</button>
          </div>
        `;
        elements.deckGrid.appendChild(row);
      });

      elements.deckGrid.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          const cardId = btn.dataset.card;
          const action = btn.dataset.action;
          const current = counts[cardId] || 0;
          if (action === "plus") {
            const currentStats = getDeckStats(owner);
            if (currentStats.count >= DECK_MAX_COUNT && current <= 0) {
              setMessage(`デッキは${DECK_MAX_COUNT}枚以内です。`);
              return;
            }
            if (currentStats.count >= DECK_MAX_COUNT && current < 3) {
              setMessage(`デッキは${DECK_MAX_COUNT}枚以内です。`);
              return;
            }
            counts[cardId] = Math.min(3, current + 1);
          } else {
            counts[cardId] = Math.max(0, current - 1);
          }
          renderDeckBuilder();
        });
      });

      const stats = getDeckStats(owner);
      const valid = isDeckValid(owner);
      const other = owner === "human" ? "cpu" : "human";
      const otherStats = getDeckStats(other);
      elements.deckOwnerSelect.value = owner;
      elements.cpuDifficultySelect.value = state.cpuDifficulty;
      const validText = valid ? "使用可能" : stats.count < DECK_MIN_COUNT ? `最低${DECK_MIN_COUNT}枚必要` : stats.count > DECK_MAX_COUNT ? `${DECK_MAX_COUNT}枚以内` : "コスト超過";
      elements.deckCountText.textContent = `${owner === "human" ? "あなた用" : "CPU用"}：${stats.count}枚 / もう片方：${otherStats.count}枚`;
      elements.deckCostText.textContent = `合計コスト：${stats.cost} / ${state.costLimit}`;
      elements.deckValidityText.textContent = validText;
      elements.deckValidityText.className = valid ? "valid" : "invalid";
      elements.deckBottomCount.textContent = `${owner === "human" ? "あなた" : "CPU"}：${stats.count}枚`;
      elements.deckBottomCost.textContent = `コスト ${stats.cost} / ${state.costLimit}`;
      elements.deckBottomValid.textContent = validText;
      elements.deckBottomValid.className = valid ? "valid" : "invalid";

      elements.applyDeckBtn.disabled = !areBothDecksValid();
      elements.costLimitInput.value = state.costLimit;
    }

    function drawCard(player) {
      if (state.decks[player].length > 0) {
        const cardId = state.decks[player].pop();
        state.hands[player].push(cardId);
        return true;
      }

      fatigue(player);
      return false;
    }

    function fatigue(player) {
      if (state.hands[player].length > 0) {
        const discarded = state.hands[player].shift();
        state.discard[player].push(discarded);
        addLog(`${handNames[player]}は山札切れ。代わりに手札から「${CARD_LIBRARY[discarded].name}」を捨てた。`);
      } else {
        const candidates = ["L", "R"].filter(h => isAlive(player, h));
        const target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : "L";
        const before = state[player][target];
        state[player][target] = normalize(before + 1, player, target);
        addLog(`${handNames[player]}は山札切れで手札もない。${handNames[target]}が${before}→${state[player][target]}。`);
        clearBrokenTraps(player);
      }
    }

    async function startTurn(player) {
      state.firstTurnStarted[player] = true;
      state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false };
      state.turn = player;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingRepairDiscard = null;
      state.pendingEqualTradeSelf = null;
      state.pendingRapidFireDiscard = null;
      elements.splitBox.classList.remove("active");
      clearHighlights();

      state.pendingTerminalEnd[player] = false;
      state.activeCostLimit[player] = state.costLimitNextTurn[player];
      state.costLimitNextTurn[player] = null;

      if (state.berserkerTurns[player] > 0) {
        addLog(`${handNames[player]}はバーサーカー状態。攻撃+2、カード使用・罠設置・分ける不可。残り${state.berserkerTurns[player]}ターン。`);
      }

      let draws = 1;
      let accelerationTriggered = false;
      let noDrawTriggered = false;
      let remainingAcceleration = state.activeAcceleration[player];
      let remainingNoDraw = state.activeNoDraw[player];

      if (state.pendingAcceleration[player] > 0) {
        state.activeAcceleration[player] += state.pendingAcceleration[player];
        state.pendingAcceleration[player] = 0;
      }

      if (state.activeAcceleration[player] > 0) {
        draws += 1;
        state.activeAcceleration[player] -= 1;
        remainingAcceleration = state.activeAcceleration[player];
        accelerationTriggered = true;
        addLog(`${handNames[player]}は「過加速」の効果で追加で1枚引く。残り${remainingAcceleration}ターン。`);

        if (state.activeAcceleration[player] === 0 && state.pendingNoDraw[player] > 0) {
          state.activeNoDraw[player] += state.pendingNoDraw[player];
          state.pendingNoDraw[player] = 0;
        }
      } else {
        if (state.pendingNoDraw[player] > 0 && state.activeNoDraw[player] === 0) {
          state.activeNoDraw[player] += state.pendingNoDraw[player];
          state.pendingNoDraw[player] = 0;
        }
      }

      if (!accelerationTriggered && state.activeNoDraw[player] > 0) {
        draws = 0;
        state.activeNoDraw[player] -= 1;
        remainingNoDraw = state.activeNoDraw[player];
        noDrawTriggered = true;
        addLog(`${handNames[player]}は「過加速」の反動で、このターン開始時にカードを引けない。残り${remainingNoDraw}ターン。`);
      }

      if (accelerationTriggered) {
        render();
        await showAccelerationPopup(player, draws, remainingAcceleration);
      } else if (noDrawTriggered) {
        render();
        await showNoDrawPopup(player, remainingNoDraw);
      }

      for (let i = 0; i < draws; i++) drawCard(player);

      if (player === "human") {
        setMessage(state.noSplit.human
          ? "あなたの番です。固定の効果で、このターンは分けるを選べません。"
          : accelerationTriggered
            ? `過過加速中です。このターンは${draws}枚ドローしました。`
            : noDrawTriggered
              ? "過加速の反動で、このターン開始時のドローはありません。"
              : "あなたの番です。カードを使うか罠を伏せてから、攻撃か分けるを選べます。");
      } else {
        setMessage(state.noSplit.cpu ? "CPUの番です。固定の効果でCPUは分けられません。" : accelerationTriggered ? `CPUは過過加速中です。このターン${draws}枚ドローしました。` : noDrawTriggered ? "CPUは過加速の反動でドローできません。" : "CPUの番です。");
      }

      render();
    }

    function render() {
      for (const player of ["human", "cpu"]) {
        for (const hand of ["L", "R"]) {
          const value = state[player][hand];
          const card = document.getElementById(`${player}${hand}`);
          if (!card.classList.contains("calculating")) {
            document.getElementById(`${player}${hand}Num`).textContent = value;
            document.getElementById(`${player}${hand}Icons`).textContent = "☝".repeat(value);
          }
          card.classList.toggle("zero", value === 0);
          card.classList.remove("selectable", "trap-target", "roulette-hand");
          if (!card.classList.contains("cpu-selected") && !card.classList.contains("calculating")) {
            card.classList.remove("selected", "hit-target");
          }

          if (!state.gameOver && !state.animating && state.turn === "human") {
            if (state.mode === "attack") {
              if (player === "human" && value > 0) card.classList.add("selectable");
              if (player === "cpu" && state.selectedAttackHand && value > 0) card.classList.add("selectable");
            }
            if ((state.mode === "setTrap" || state.mode === "setupTrap" || state.mode === "setBlessing") && player === "human" && value > 0 && state.traps.human[hand].length < 2) {
              card.classList.add("trap-target");
            }
            if (state.mode === "setCurse" && player === "cpu" && value > 0 && state.traps.cpu[hand].length < 2) {
              card.classList.add("trap-target");
            }
            if (state.mode === "moveOne" && player === "human" && getMoveOneOptionFrom("human", hand)) {
              card.classList.add("trap-target");
            }
            if (state.mode === "repair" && player === "human" && value === 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "randomDice" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "equalTradeSelf" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "equalTradeOpponent" && player === "cpu" && value >= 2) {
              card.classList.add("trap-target");
            }
            if (state.mode === "snipe" && player === "cpu" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "rapidFireTarget" && player === "cpu" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "cursedBullet" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
          }

          if (state.highlight && state.highlight.player === player && state.highlight.hand === hand && state.highlight.type === "roulette") {
            card.classList.add("roulette-hand");
          }

          if (player === "human" && hand === state.selectedAttackHand && !state.animating) {
            card.classList.add("selected");
          }

          renderTrapSlots(player, hand);
        }
      }

      elements.humanState.textContent =
        state.gameOver ? "" : state.turn === "human" ? "あなたの番です" : "CPUの番です";
      elements.cpuState.textContent =
        state.gameOver ? "" : state.turn === "cpu" ? "考え中…" : "待機中";

      const lock = state.animating || state.turn !== "human" || state.gameOver;
      const setupActive = state.turn === "human" && state.temp.human.setupMode && !state.gameOver;
      elements.attackBtn.disabled = lock || setupActive;
      elements.splitBtn.disabled = lock || setupActive || state.noSplit.human || state.berserkerTurns.human > 0 || !canHumanSplit();
      elements.drawBtn.disabled = lock || setupActive;
      elements.cancelBtn.disabled = lock && !setupActive;
      elements.cancelBtn.textContent = setupActive ? "仕込み終了" : "解除";
      elements.confirmSplitBtn.disabled = lock || setupActive;

      elements.humanDeckCount.textContent = state.decks.human.length;
      elements.cpuDeckCount.textContent = state.decks.cpu.length;
      elements.handInfo.textContent = `あなた ${state.hands.human.length}枚 / CPU ${state.hands.cpu.length}枚`;
      renderHumanCards();
      renderLastAction();

      elements.log.innerHTML = state.log.map(item => `<div>${escapeHtml(item)}</div>`).join("");
      updateSplitOptions();
    }

    function makeTrapInstance(cardId) {
      const instance = {
        id: `trap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        cardId
      };
      if (cardId === "weaknessCurse") instance.waitTurns = 1;
      return instance;
    }

    function trapCardId(slot) {
      return typeof slot === "string" ? slot : slot?.cardId;
    }

    function trapInstanceId(slot) {
      return typeof slot === "string" ? null : slot?.id;
    }

    function isTrapCard(cardId) {
      return !!CARD_LIBRARY[cardId]?.trap;
    }

    function isBlessingCard(cardId) {
      return !!CARD_LIBRARY[cardId]?.blessing;
    }

    function isCurseCard(cardId) {
      return !!CARD_LIBRARY[cardId]?.curse;
    }

    function isAttachmentCard(cardId) {
      const card = CARD_LIBRARY[cardId];
      return !!(card?.trap || card?.blessing || card?.curse);
    }

    function attachmentKind(cardId) {
      const card = CARD_LIBRARY[cardId];
      if (card?.trap) return "trap";
      if (card?.blessing) return "blessing";
      if (card?.curse) return "curse";
      return "card";
    }

    function attachmentLabel(cardId) {
      const kind = attachmentKind(cardId);
      if (kind === "trap") return "罠";
      if (kind === "blessing") return "加護";
      if (kind === "curse") return "呪縛";
      return "カード";
    }

    function canPlaceAttachment(user, owner) {
      return ["L", "R"].some(h => state[owner][h] > 0 && state.traps[owner][h].length < 2 && !(user === owner && hasSealCurse(owner, h)));
    }

    function hasAttachment(owner, hand, cardId) {
      return state.traps[owner][hand].some(slot => trapCardId(slot) === cardId);
    }

    function hasExposedCurse(owner, hand) {
      return hasAttachment(owner, hand, "exposeCurse");
    }

    function hasSealCurse(owner, hand) {
      return hasAttachment(owner, hand, "sealCurse");
    }

    function hasImmutableCurse(owner, hand) {
      return hasAttachment(owner, hand, "immutableCurse");
    }

    function canReceiveBlessing(owner, hand) {
      return state[owner][hand] > 0 && state.traps[owner][hand].length < 2 && !hasSealCurse(owner, hand);
    }

    function ignoresOpponentBoardEffects(attacker) {
      return !!state.temp[attacker]?.breakthrough;
    }

    function applyGuardBlessingReduction(defender, targetHand, amount, sourceLabel = "効果") {
      let finalAmount = Math.max(1, amount);
      if (hasAttachment(defender, targetHand, "guardBlessing")) {
        const reduced = Math.max(1, finalAmount - 1);
        if (reduced !== finalAmount) {
          addLog(`${handNames[defender]}の${handNames[targetHand]}の「守護」により、${sourceLabel}の本数が${finalAmount}→${reduced}になった。`);
        } else {
          addLog(`${handNames[defender]}の${handNames[targetHand]}には「守護」があるが、${sourceLabel}は1本未満にならない。`);
        }
        finalAmount = reduced;
      }
      return finalAmount;
    }

    function hasOwnCurse(player) {
      return ["L", "R"].some(hand => state.traps[player][hand].some(slot => isCurseCard(trapCardId(slot))));
    }

    function chooseCpuOwnCurse(player) {
      const options = [];
      for (const hand of ["L", "R"]) {
        state.traps[player][hand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          if (isCurseCard(cardId)) options.push({ hand, index, cardId });
        });
      }
      if (options.length === 0) return null;
      options.sort((a, b) => (CARD_LIBRARY[b.cardId].cost || 0) - (CARD_LIBRARY[a.cardId].cost || 0));
      return options[0];
    }

    function removeOwnCurse(player, hand, index) {
      const slot = state.traps[player][hand][index];
      const cardId = trapCardId(slot);
      if (!isCurseCard(cardId)) return false;
      const instanceId = trapInstanceId(slot);
      state.traps[player][hand].splice(index, 1);
      if (instanceId) state.revealedTrapIds.delete(instanceId);
      state.discard[player].push(cardId);
      setLastAction(player, "解呪", `${handNames[hand]}の呪縛「${CARD_LIBRARY[cardId].name}」を捨て札にしました。`, "card");
      addLog(`${handNames[player]}は「解呪」で${handNames[hand]}の呪縛「${CARD_LIBRARY[cardId].name}」を捨て札にした。`);
      if (player === "human") {
        state.mode = "attack";
        state.pendingTrapTargetEffect = null;
        setMessage(`「解呪」：${handNames[hand]}の呪縛を捨て札にしました。まだ攻撃か分けるができます。`);
      }
      render();
      return true;
    }

    function chooseMagicMirrorTarget(owner) {
      const options = ["L", "R"].filter(h => state[owner][h] > 0 && state.traps[owner][h].length < 2);
      if (options.length === 0) return null;
      options.sort((a, b) => {
        const scoreA = state.traps[owner][a].length * -10 + state[owner][a];
        const scoreB = state.traps[owner][b].length * -10 + state[owner][b];
        return scoreB - scoreA;
      });
      return options[0];
    }

    function isBlessingOrCurseCard(cardId) {
      return isBlessingCard(cardId) || isCurseCard(cardId);
    }

    function getAttachmentOptions(owner, predicate = isBlessingOrCurseCard) {
      const options = [];
      for (const hand of ["L", "R"]) {
        state.traps[owner][hand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          if (predicate(cardId)) options.push({ owner, hand, index, cardId });
        });
      }
      return options;
    }

    function hasSwapTargets(player) {
      const opponent = player === "human" ? "cpu" : "human";
      return getAttachmentOptions(opponent).length > 0 && getAttachmentOptions(player).length > 0;
    }

    function chooseCpuSwapPair(player) {
      const opponent = player === "human" ? "cpu" : "human";
      const opponentOptions = getAttachmentOptions(opponent);
      const ownOptions = getAttachmentOptions(player);
      if (opponentOptions.length === 0 || ownOptions.length === 0) return null;

      opponentOptions.sort((a, b) => {
        const score = (info) => {
          if (isBlessingCard(info.cardId)) return 100 + (CARD_LIBRARY[info.cardId].cost || 0);
          if (isCurseCard(info.cardId)) return 20 - (CARD_LIBRARY[info.cardId].cost || 0);
          return 0;
        };
        return score(b) - score(a);
      });
      ownOptions.sort((a, b) => {
        const score = (info) => {
          if (isCurseCard(info.cardId)) return 100 + (CARD_LIBRARY[info.cardId].cost || 0);
          if (isBlessingCard(info.cardId)) return 20 - (CARD_LIBRARY[info.cardId].cost || 0);
          return 0;
        };
        return score(b) - score(a);
      });

      return { opponent: opponentOptions[0], own: ownOptions[0] };
    }

    function swapAttachments(player, opponentInfo, ownInfo) {
      const opponent = player === "human" ? "cpu" : "human";
      if (!opponentInfo || !ownInfo) return false;
      if (opponentInfo.owner !== opponent || ownInfo.owner !== player) return false;

      const opponentSlot = state.traps[opponentInfo.owner][opponentInfo.hand][opponentInfo.index];
      const ownSlot = state.traps[ownInfo.owner][ownInfo.hand][ownInfo.index];
      const opponentCardId = trapCardId(opponentSlot);
      const ownCardId = trapCardId(ownSlot);
      if (!isBlessingOrCurseCard(opponentCardId) || !isBlessingOrCurseCard(ownCardId)) return false;

      state.traps[opponentInfo.owner][opponentInfo.hand][opponentInfo.index] = ownSlot;
      state.traps[ownInfo.owner][ownInfo.hand][ownInfo.index] = opponentSlot;

      setLastAction(player, "すりかえ", `「${CARD_LIBRARY[opponentCardId].name}」と「${CARD_LIBRARY[ownCardId].name}」を入れ替えました。`, "card");
      addLog(`${handNames[player]}は「すりかえ」で、${handNames[opponent]}の${handNames[opponentInfo.hand]}の「${CARD_LIBRARY[opponentCardId].name}」と、自分の${handNames[ownInfo.hand]}の「${CARD_LIBRARY[ownCardId].name}」を入れ替えた。`);
      if (player === "human") {
        state.mode = "attack";
        state.pendingSwapFirst = null;
        setMessage("「すりかえ」：加護・呪縛を入れ替えました。まだ攻撃か分けるができます。");
      }
      render();
      return true;
    }

    async function askHumanMagicMirrorChoice(owner, hand, cardId) {
      return new Promise(resolve => {
        elements.trapChoiceList.innerHTML = "";
        elements.trapChoiceText.textContent = `${handNames[owner]}の${handNames[hand]}に「${CARD_LIBRARY[cardId].name}」が置かれようとしています。マジックミラーを発動しますか？`;
        const div = document.createElement("div");
        div.className = "trap-choice-card";
        div.innerHTML = `
          <div class="card-title">
            <span>「マジックミラー」</span>
            <span class="card-type trap">罠</span>
          </div>
          <div class="card-cost">設置場所：${handNames[hand]} / コスト 2</div>
          <div class="card-text">その呪縛を相手側へ反射します。</div>
        `;
        div.addEventListener("click", () => {
          cleanup();
          resolve(true);
        });
        elements.trapChoiceList.appendChild(div);

        const cleanup = () => {
          elements.trapChoice.classList.remove("show");
          elements.trapSkipBtn.onclick = null;
        };
        elements.trapSkipBtn.onclick = () => {
          cleanup();
          resolve(false);
        };
        elements.trapChoice.classList.add("show");
      });
    }

    async function maybeReflectCurseWithMagicMirror(player, owner, hand, cardId) {
      const mirrorIndex = state.traps[owner][hand].findIndex(slot => trapCardId(slot) === "magicMirror");
      if (mirrorIndex < 0) return false;

      let useMirror = false;
      if (owner === "human") {
        useMirror = await askHumanMagicMirrorChoice(owner, hand, cardId);
      } else {
        useMirror = true;
      }
      if (!useMirror) return false;

      const [mirrorSlot] = state.traps[owner][hand].splice(mirrorIndex, 1);
      const mirrorInstanceId = trapInstanceId(mirrorSlot);
      if (mirrorInstanceId) state.revealedTrapIds.delete(mirrorInstanceId);
      state.discard[owner].push("magicMirror");

      const targetOwner = player;
      const reflectedHand = chooseMagicMirrorTarget(targetOwner);
      setLastAction(owner, "マジックミラー", `呪縛「${CARD_LIBRARY[cardId].name}」を反射しました。`, "trap");
      addLog(`【罠】${handNames[owner]}の「マジックミラー」が発動。「${CARD_LIBRARY[cardId].name}」を反射した。`);
      await showCardPopup(owner, CARD_LIBRARY.magicMirror, true, 760);

      if (reflectedHand) {
        state.traps[targetOwner][reflectedHand].push(makeTrapInstance(cardId));
        addLog(`反射された「${CARD_LIBRARY[cardId].name}」は${handNames[targetOwner]}の${handNames[reflectedHand]}に表向きで置かれた。`);
        setMessage(`「マジックミラー」：「${CARD_LIBRARY[cardId].name}」を${handNames[targetOwner]}の${handNames[reflectedHand]}へ反射しました。`);
      } else {
        state.discard[player].push(cardId);
        addLog(`反射先がなかったため、「${CARD_LIBRARY[cardId].name}」は捨て札になった。`);
        setMessage(`「マジックミラー」：反射先がなかったため、呪縛は捨て札になりました。`);
      }
      render();
      return true;
    }

    function hasOpponentTrap(player) {
      const opponent = player === "human" ? "cpu" : "human";
      return ["L", "R"].some(hand => state.traps[opponent][hand].some(slot => isTrapCard(trapCardId(slot))));
    }

    function hasMovableOpponentTrap(player) {
      const opponent = player === "human" ? "cpu" : "human";
      return ["L", "R"].some(hand => {
        const other = otherHand(hand);
        return state.traps[opponent][hand].length > 0 &&
          state[opponent][other] > 0 &&
          state.traps[opponent][other].length < 2;
      });
    }

    function chooseCpuMovableOpponentTrap(owner) {
      const options = [];
      for (const hand of ["L", "R"]) {
        const other = otherHand(hand);
        if (state[owner][other] <= 0 || state.traps[owner][other].length >= 2) continue;
        state.traps[owner][hand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          if (!cardId) return;
          options.push({ owner, hand, index, cardId });
        });
      }
      if (options.length === 0) return null;
      options.sort((a, b) => (CARD_LIBRARY[b.cardId].cost || 0) - (CARD_LIBRARY[a.cardId].cost || 0));
      return options[0];
    }

    function discardOneCard(player) {
      if (state.hands[player].length === 0) return null;
      const index = Math.floor(Math.random() * state.hands[player].length);
      const [cardId] = state.hands[player].splice(index, 1);
      state.discard[player].push(cardId);
      return cardId;
    }

    async function handleCardDiscardEffect(player, cardId) {
      const card = CARD_LIBRARY[cardId];
      if (!card?.bullet) return;
      const opponent = player === "human" ? "cpu" : "human";

      if (cardId === "accelBullet") {
        await showPopup(player, "加速弾", "捨てられた時効果：カードを1枚引く。", "card", 760);
        drawCard(player);
        addLog(`${handNames[player]}の「加速弾」効果。1枚引いた。`);
      } else if (cardId === "specialBullet") {
        await showPopup(player, "特殊弾", `捨てられた時効果：${handNames[opponent]}の手札をランダムに1枚捨てさせる。`, "card", 760);
        const discarded = discardOneCard(opponent);
        addLog(`${handNames[player]}の「特殊弾」効果。${handNames[opponent]}は${discarded ? `「${CARD_LIBRARY[discarded].name}」` : "手札"}を1枚捨てた。`);
        if (discarded) await handleCardDiscardEffect(opponent, discarded);
      } else if (cardId === "pierceBullet") {
        await showPopup(player, "貫通弾", `捨てられた時効果：${handNames[opponent]}の設置済み罠をランダムに1枚捨てる。`, "card", 760);
        const removed = removeRandomTrap(opponent);
        addLog(`${handNames[player]}の「貫通弾」効果。${removed ? `${handNames[opponent]}の罠「${CARD_LIBRARY[removed].name}」を捨て札にした。` : `${handNames[opponent]}に罠はなかった。`}`);
      }
    }

    function removeRandomTrap(player) {
      const options = [];
      for (const hand of ["L", "R"]) {
        state.traps[player][hand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          if (!isTrapCard(cardId)) return;
          options.push({ hand, index, cardId, instanceId: trapInstanceId(slot) });
        });
      }
      if (options.length === 0) return null;
      const picked = options[Math.floor(Math.random() * options.length)];
      const [slot] = state.traps[player][picked.hand].splice(picked.index, 1);
      const cardId = trapCardId(slot);
      const instanceId = trapInstanceId(slot);
      if (instanceId) state.revealedTrapIds.delete(instanceId);
      if (cardId) state.discard[player].push(cardId);
      return cardId;
    }

    function chooseCpuRapidFireDiscardIndex() {
      if (state.hands.cpu.length === 0) return -1;
      let bestIndex = -1;
      let bestScore = -1;
      state.hands.cpu.forEach((cardId, index) => {
        if (cardId === "rapidFire") return;
        const card = CARD_LIBRARY[cardId];
        const score = (card?.cost || 0) + (card?.bullet ? 1 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      return bestIndex >= 0 ? bestIndex : 0;
    }

    function chooseCpuSnipeTarget() {
      const choices = ["L", "R"].filter(h => state.human[h] > 0);
      if (choices.length === 0) return null;
      choices.sort((a, b) => {
        const scoreA = state.human[a] === 4 ? 100 : state.human[a];
        const scoreB = state.human[b] === 4 ? 100 : state.human[b];
        return scoreB - scoreA;
      });
      return choices[0];
    }

    async function applySnipe(player, defender, targetHand) {
      if (state[defender][targetHand] <= 0) return false;
      const before = state[defender][targetHand];
      const amount = applyGuardBlessingReduction(defender, targetHand, 1, "狙撃");
      const total = before + amount;
      const finalValue = normalize(total, defender, targetHand);
      await animateCalculation(defender, targetHand, total, finalValue);
      state[defender][targetHand] = finalValue;
      addLog(`${handNames[player]}は「狙撃」で${handNames[defender]}の${handNames[targetHand]}に${amount}本加えた。${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      setLastAction(player, "狙撃", `${handNames[defender]}の${handNames[targetHand]}を+1しました。`, "card");
      clearBrokenTraps(defender);
      if (player === "human") {
        state.mode = "attack";
        setMessage(`「狙撃」：${handNames[defender]}の${handNames[targetHand]}に本数を加えました。まだ攻撃か分けるができます。`);
      }
      render();
      return true;
    }

    function chooseCpuDiscardIndex() {
      if (state.hands.cpu.length === 0) return -1;
      let bestIndex = -1;
      let bestCost = Infinity;
      state.hands.cpu.forEach((cardId, index) => {
        if (cardId === "repair") return;
        const cost = CARD_LIBRARY[cardId]?.cost ?? 99;
        if (cost < bestCost) {
          bestCost = cost;
          bestIndex = index;
        }
      });
      return bestIndex >= 0 ? bestIndex : 0;
    }

    function chooseCpuOpponentTrap(owner) {
      const options = [];
      for (const hand of ["L", "R"]) {
        state.traps[owner][hand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          if (!isTrapCard(cardId)) return;
          options.push({ owner, hand, index, cardId });
        });
      }
      if (options.length === 0) return null;
      options.sort((a, b) => (CARD_LIBRARY[b.cardId].cost || 0) - (CARD_LIBRARY[a.cardId].cost || 0));
      return options[0];
    }

    function removeOpponentTrap(user, owner, hand, index) {
      const slot = state.traps[owner][hand][index];
      const cardId = trapCardId(slot);
      if (!cardId || !isTrapCard(cardId)) return false;
      const instanceId = trapInstanceId(slot);
      state.traps[owner][hand].splice(index, 1);
      if (instanceId) state.revealedTrapIds.delete(instanceId);
      state.discard[owner].push(cardId);
      setLastAction(user, "解除", `${handNames[owner]}の${handNames[hand]}の伏せカードを捨て札にしました。`, "card");
      addLog(`${handNames[user]}は「解除」で、${handNames[owner]}の${handNames[hand]}の伏せカード「${CARD_LIBRARY[cardId].name}」を捨て札にした。`);
      setMessage(`「解除」：${handNames[owner]}の${handNames[hand]}の伏せカードを捨て札にしました。`);
      state.mode = "attack";
      state.pendingTrapTargetEffect = null;
      render();
      return true;
    }

    function revealOpponentTrap(user, owner, hand, index) {
      const slot = state.traps[owner][hand][index];
      const cardId = trapCardId(slot);
      if (!cardId || !isTrapCard(cardId)) return false;
      const instanceId = trapInstanceId(slot);
      if (instanceId) state.revealedTrapIds.add(instanceId);
      const card = CARD_LIBRARY[cardId];
      setLastAction(user, "看破", `${handNames[owner]}の${handNames[hand]}の伏せカードは「${card.name}」でした。`, "card");
      addLog(`${handNames[user]}は「看破」で、${handNames[owner]}の${handNames[hand]}の伏せカード「${card.name}」を確認した。`);
      setMessage(`「看破」：${handNames[owner]}の${handNames[hand]}の伏せカードは「${card.name}」でした。`);
      state.mode = "attack";
      state.pendingTrapTargetEffect = null;
      render();
      return true;
    }

    function moveOpponentTrap(user, owner, hand, index) {
      const other = otherHand(hand);
      if (state[owner][other] <= 0 || state.traps[owner][other].length >= 2) {
        setMessage("そのカードは移動先がないため選べません。");
        return false;
      }
      const slot = state.traps[owner][hand][index];
      const cardId = trapCardId(slot);
      if (!cardId) return false;
      state.traps[owner][hand].splice(index, 1);
      state.traps[owner][other].push(slot);
      const label = attachmentLabel(cardId);
      setLastAction(user, "手繰り寄せ", `${handNames[owner]}の${label}「${CARD_LIBRARY[cardId].name}」を${handNames[hand]}から${handNames[other]}へ移動しました。`, "card");
      addLog(`${handNames[user]}は「手繰り寄せ」で、${handNames[owner]}の${label}「${CARD_LIBRARY[cardId].name}」を${handNames[hand]}から${handNames[other]}へ移動した。`);
      setMessage(`「手繰り寄せ」：${handNames[owner]}のカードを${handNames[hand]}から${handNames[other]}へ移動しました。`);
      state.mode = "attack";
      state.pendingTrapTargetEffect = null;
      render();
      return true;
    }

    function chooseOpponentTrapSlot(owner, hand, index) {
      if (state.mode !== "chooseOpponentTrap" || owner !== "cpu") return;
      const cardId = trapCardId(state.traps[owner][hand][index]);
      if (state.pendingTrapTargetEffect !== "move" && !isTrapCard(cardId)) {
        setMessage("加護・呪縛は解除・看破の対象にはできません。");
        return;
      }
      if (state.pendingTrapTargetEffect === "remove") {
        removeOpponentTrap("human", owner, hand, index);
      } else if (state.pendingTrapTargetEffect === "reveal") {
        revealOpponentTrap("human", owner, hand, index);
      } else if (state.pendingTrapTargetEffect === "move") {
        moveOpponentTrap("human", owner, hand, index);
      }
    }

    function chooseOwnCurseSlot(owner, hand, index) {
      if (state.mode !== "chooseOwnCurse" || owner !== "human") return;
      if (!isCurseCard(trapCardId(state.traps[owner][hand][index]))) {
        setMessage("解呪では自分の手に置かれた呪縛だけを選べます。");
        return;
      }
      removeOwnCurse("human", hand, index);
    }

    function chooseSwapAttachmentSlot(owner, hand, index) {
      const slot = state.traps[owner][hand][index];
      const cardId = trapCardId(slot);
      if (!isBlessingOrCurseCard(cardId)) {
        setMessage("すりかえでは加護・呪縛だけを選べます。");
        return;
      }
      if (state.mode === "swapOpponentAttachment") {
        if (owner !== "cpu") {
          setMessage("まず相手の加護・呪縛を選んでください。");
          return;
        }
        state.pendingSwapFirst = { owner, hand, index, cardId };
        state.mode = "swapOwnAttachment";
        setMessage("次に自分の加護・呪縛を選んでください。");
        render();
        return;
      }
      if (state.mode === "swapOwnAttachment") {
        if (owner !== "human") {
          setMessage("次に自分の加護・呪縛を選んでください。");
          return;
        }
        swapAttachments("human", state.pendingSwapFirst, { owner, hand, index, cardId });
      }
    }

    function renderTrapSlots(player, hand) {
      const box = document.getElementById(`${player}${hand}Traps`);
      const traps = state.traps[player][hand];
      box.innerHTML = "";
      for (let i = 0; i < 2; i++) {
        const div = document.createElement("div");
        const slot = traps[i];
        const cardId = trapCardId(slot);
        const card = CARD_LIBRARY[cardId];
        const instanceId = trapInstanceId(slot);
        const revealed = instanceId && state.revealedTrapIds.has(instanceId);
        const faceUpAttachment = cardId && !card?.trap;
        const exposedByCurse = card?.trap && hasExposedCurse(player, hand);
        if (cardId) {
          const isTrap = isTrapCard(cardId);
          const selectableOpponentTrap = state.turn === "human" && !state.animating && state.mode === "chooseOpponentTrap" && player === "cpu" &&
            (state.pendingTrapTargetEffect === "move"
              ? (state[player][otherHand(hand)] > 0 && state.traps[player][otherHand(hand)].length < 2)
              : isTrap);
          const selectableOwnCurse = isCurseCard(cardId) && state.turn === "human" && !state.animating && state.mode === "chooseOwnCurse" && player === "human";
          const selectableSwapOpponent = isBlessingOrCurseCard(cardId) && state.turn === "human" && !state.animating && state.mode === "swapOpponentAttachment" && player === "cpu";
          const selectableSwapOwn = isBlessingOrCurseCard(cardId) && state.turn === "human" && !state.animating && state.mode === "swapOwnAttachment" && player === "human";
          const selectable = selectableOpponentTrap || selectableOwnCurse || selectableSwapOpponent || selectableSwapOwn;
          const hidden = isTrap && player === "cpu" && !revealed && !exposedByCurse;
          div.className =
            "trap-slot filled" +
            (hidden ? " cpu-hidden" : "") +
            (revealed || exposedByCurse || faceUpAttachment ? " revealed-info" : "") +
            (card?.blessing ? " blessing-slot" : "") +
            (card?.curse ? " curse-slot" : "") +
            (selectable ? " selectable-trap-card" : "");
          div.textContent = hidden ? `伏せ${i + 1}` : card.name;
          if (selectable) {
            div.title = "このカードを選ぶ";
            div.addEventListener("click", (event) => {
              event.stopPropagation();
              if (state.mode === "chooseOwnCurse") chooseOwnCurseSlot(player, hand, i);
              else if (state.mode === "swapOpponentAttachment" || state.mode === "swapOwnAttachment") chooseSwapAttachmentSlot(player, hand, i);
              else chooseOpponentTrapSlot(player, hand, i);
            });
          }
        } else {
          div.className = "trap-slot";
          div.textContent = "空き";
        }
        box.appendChild(div);
      }
    }


function renderLastAction() {
      if (!state.lastAction) {
        elements.lastCardDisplay.className = "last-card empty";
        elements.lastCardDisplay.textContent = "まだ行動はありません。";
        return;
      }

      const trapClass = state.lastAction.kind === "trap" ? " trap" : "";
      elements.lastCardDisplay.className = "last-card";
      elements.lastCardDisplay.innerHTML = `
        <span class="last-card-user">${escapeHtml(handNames[state.lastAction.player])}</span>
        <span class="last-card-name">${escapeHtml(state.lastAction.title)}</span>
        <span class="card-type${trapClass}">${escapeHtml(state.lastAction.kind === "trap" ? "罠" : "行動")}</span>
        <span class="last-card-text">${escapeHtml(state.lastAction.text || "")}</span>
      `;
    }

    function renderHumanCards() {
      elements.humanCards.innerHTML = "";

      if (state.hands.human.length === 0) {
        elements.humanCards.innerHTML = `<p class="small">手札はありません。</p>`;
        return;
      }

      state.hands.human.forEach((cardId, index) => {
        const card = CARD_LIBRARY[cardId];
        const isTrap = !!card.trap;
        const isZoneCard = !!(card.trap || card.blessing || card.curse);
        const setupActive = state.turn === "human" && !state.gameOver && !state.animating && state.temp.human.setupMode;
        const repairDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "repairDiscard";
        const calmDownDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "calmDownDiscard";
        const rapidFireDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "rapidFireDiscard";
        const restrictedByCost = state.activeCostLimit.human !== null && card.cost > state.activeCostLimit.human;
        const berserkLocked = state.berserkerTurns.human > 0 && !state.temp.human.berserkerJustUsed;
        const canUseCardAction = state.turn === "human" && !state.gameOver && !state.animating && !state.temp.human.cardActionUsed && !berserkLocked;
        const normalPlayable = !repairDiscardMode && !calmDownDiscardMode && !rapidFireDiscardMode && !restrictedByCost && canUseCardAction && !isZoneCard && card.canPlay("human");
        const trapPlayable = !repairDiscardMode && !calmDownDiscardMode && !rapidFireDiscardMode && !restrictedByCost && !berserkLocked && ((canUseCardAction && isZoneCard && !setupActive) || (setupActive && isTrap)) && canSetAttachmentTarget("human", cardId);
        const discardPlayable = repairDiscardMode && cardId !== "repair";
        const calmDiscardPlayable = calmDownDiscardMode && cardId !== "calmDown";
        const rapidDiscardPlayable = rapidFireDiscardMode && cardId !== "rapidFire";
        const selected = state.selectedTrapCardIndex === index;
        const div = document.createElement("div");
        div.className =
          "game-card" +
          (card.blessing ? " blessing-card" : "") +
          (card.curse ? " curse-card" : "") +
          (normalPlayable ? " playable" : "") +
          (trapPlayable ? " trap-playable" : "") +
          (discardPlayable || calmDiscardPlayable || rapidDiscardPlayable ? " playable" : "") +
          (selected ? " selected-card" : "");
        div.innerHTML = `
          <div class="card-title">
            <span>${escapeHtml(card.name)}</span>
            <span class="card-type${isTrap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
          </div>
          <div class="card-cost">コスト ${card.cost}</div>
          <div class="card-text">${escapeHtml(card.text)}</div>
          ${discardPlayable ? '<div class="used">補修：このカードを捨てる</div>' : calmDiscardPlayable ? '<div class="used">落ち着ける：このカードを捨てる</div>' : rapidDiscardPlayable ? '<div class="used">乱射：このカードを捨てる</div>' : restrictedByCost ? '<div class="used">倹約令：使用不可</div>' : berserkLocked ? '<div class="used">バーサーカー中：使用不可</div>' : state.temp.human.setupMode && isTrap ? '<div class="used">仕込み中：設置可能</div>' : state.temp.human.cardActionUsed ? '<div class="used">カード関連行動は使用済み</div>' : ''}
        `;
        if (discardPlayable) {
          div.addEventListener("click", () => chooseRepairDiscard(index));
        }
        if (calmDiscardPlayable) {
          div.addEventListener("click", () => chooseCalmDownDiscard(index));
        }
        if (rapidDiscardPlayable) {
          div.addEventListener("click", () => chooseRapidFireDiscard(index));
        }
        if (normalPlayable) {
          div.addEventListener("click", () => playCard("human", index));
        }
        if (trapPlayable) {
          div.addEventListener("click", () => selectTrapCard(index));
        }
        elements.humanCards.appendChild(div);
      });
    }

    function escapeHtml(text) {
      return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function timingLabel(card) {
      if (card.blessing) return "加護・表向き";
      if (card.curse) return "呪縛・表向き";
      if (!card.trap) return "通常";
      const timing = card.triggerTiming === "after" ? "攻撃判定後" : "攻撃判定前";
      const manual = card.manual ? "手動" : "自動";
      return `${timing}・${manual}`;
    }

    function openHelp(tab = "basic") {
      renderHelp(tab);
      elements.helpModal.classList.add("show");
    }

    function closeHelp() {
      elements.helpModal.classList.remove("show");
    }

    function renderHelp(tab = "basic") {
      elements.helpTabs.querySelectorAll("button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.helpTab === tab);
      });

      if (tab === "basic") {
        elements.helpBody.innerHTML = `
          <h3>基本ルール</h3>
          <ul>
            <li>お互いの左右の手は<strong>1・1</strong>から始まります。</li>
            <li>相手の両手を<strong>0</strong>にしたら勝ちです。</li>
            <li>0の手では攻撃できません。</li>
            <li>0の手には罠を伏せられません。</li>
            <li>手が0になったら、その手の下の罠はすべて捨て札になります。</li>
          </ul>
          <div class="help-note">
            攻撃で5以上になった場合は5で割った余りになります。例：2+3=5→0、3+3=6→1、4+3=7→2。
          </div>
          <h3>分ける</h3>
          <ul>
            <li>左右の合計本数を、別の形に分け直せます。</li>
            <li>通常の「分ける」では、どちらかの手を0にすることはできません。</li>
            <li>まったく同じ形にすることはできません。</li>
            <li>左右を入れ替えるだけの分け方は可能です。</li>
          </ul>
        `;
        return;
      }

      if (tab === "turn") {
        elements.helpBody.innerHTML = `
          <h3>ターンの流れ</h3>
          <ol>
            <li>ターン開始時にカードを1枚引きます。</li>
            <li>カード関連行動を1回だけ行えます。</li>
            <li>その後、攻撃か分けるを1回行います。</li>
            <li>行動後、相手のターンになります。</li>
          </ol>
          <h3>カード関連行動</h3>
          <ul>
            <li>補助カードを使う</li>
            <li>罠カードを自分の手の下に伏せる</li>
          </ul>
          <div class="help-note">
            補助カード使用と罠設置は合わせて1ターン1回です。強打を使ったターンに罠を伏せることはできません。ただし「仕込み」中は罠カードだけ好きなだけ伏せられます。
          </div>
          <h3>山札切れ</h3>
          <ul>
            <li>山札がない状態で引く場合、代わりに手札を1枚捨てます。</li>
            <li>手札もない場合、自分の生きている手が1本増えます。</li>
          </ul>
        `;
        return;
      }

      if (tab === "attack") {
        elements.helpBody.innerHTML = `
          <h3>攻撃の処理</h3>
          <ol>
            <li>攻撃する手を選びます。</li>
            <li>攻撃対象の手を選びます。</li>
            <li>攻撃判定前の罠を発動できます。</li>
            <li>攻撃が通る場合、対象の手に本数を足します。</li>
            <li>攻撃判定後の罠を発動できます。</li>
            <li>手が0になった場合、その手の下の罠は捨て札になります。</li>
          </ol>
          <h3>罠タイミング</h3>
          <ul>
            <li><strong>攻撃判定前：</strong>数値が増える前に発動します。対象変更や攻撃無効に向いています。</li>
            <li><strong>攻撃判定後：</strong>数値が変わった後に発動します。囮や踏み止まりのような結果に反応する罠です。</li>
            <li>1回の攻撃で発動できる罠は最大1枚です。</li>
          </ul>
          <div class="help-note">
            例：空振りは攻撃判定前なので「2+3→空振り→2」。囮は攻撃判定後なので、攻撃を受けた後に1枚引きます。
          </div>
        `;
        return;
      }

      if (tab === "cards") {
        const cards = Object.entries(CARD_LIBRARY).map(([id, card]) => {
          const typeClass = card.trap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : "";
          const timing = timingLabel(card);
          return `
            <div class="help-card">
              <div class="help-card-title">
                <span>${escapeHtml(card.name)}</span>
                <span class="help-badges">
                  <span class="help-badge${typeClass}">${escapeHtml(card.type)}</span>
                  <span class="help-badge cost">コスト${card.cost}</span>
                  <span class="help-badge timing">${escapeHtml(timing)}</span>
                </span>
              </div>
              <div class="card-text">${escapeHtml(card.text)}</div>
            </div>
          `;
        }).join("");

        elements.helpBody.innerHTML = `
          <h3>カード一覧</h3>
          <div class="help-note">
            罠カードには発動タイミングがあります。攻撃判定前は数値が増える前、攻撃判定後は数値が変わった後です。
          </div>
          <div class="help-card-list">${cards}</div>
        `;
        return;
      }

      if (tab === "deck") {
        elements.helpBody.innerHTML = `
          <h3>デッキ編集</h3>
          <ul>
            <li>あなた用デッキとCPU用デッキを別々に編集できます。</li>
            <li>同名カードは最大3枚までです。</li>
            <li>デッキは最低6枚必要です。</li>
            <li>合計コストがコスト上限を超えると、そのデッキではリスタートできません。</li>
            <li>デッキ保存を押すと、同じ端末・同じブラウザに保存されます。</li>
          </ul>
          <h3>保存とデッキコード</h3>
          <div class="help-note">
            通常のデッキ保存はブラウザのlocalStorageを使っています。同じ端末・同じブラウザなら残ります。別端末へ引き継ぐ場合は、デッキコードを発行してコピーしてください。
          </div>
          <ul>
            <li>表示中デッキのコード発行：あなた用かCPU用の片方だけを共有します。</li>
            <li>両方のコード発行：あなた用とCPU用をまとめて共有します。</li>
            <li>コードを読み込む：貼り付けたコードからデッキを復元します。</li>
          </ul>
          <h3>CPU用デッキ</h3>
          <ul>
            <li>CPU用デッキを強くすると、CPUもそのカード構成で戦います。</li>
            <li>「もう片方へコピー」で、あなた用とCPU用を同じ構成にできます。</li>
          </ul>
        `;
      }
    }

    function canHumanSplit() {
      return getSplitOptions("human").length > 0;
    }

    function getSplitOptions(player) {
      const total = state[player].L + state[player].R;
      const currentL = state[player].L;
      const currentR = state[player].R;
      const options = [];

      if (total <= 1) return options;

      for (let left = 1; left <= 4; left++) {
        const right = total - left;
        if (right < 1 || right > 4) continue;
        const same = left === currentL && right === currentR;
        if (same) continue;
        options.push({ L: left, R: right });
      }

      return options;
    }

    function getMoveOneOptionFrom(player, from) {
      const current = { L: state[player].L, R: state[player].R };
      const to = from === "L" ? "R" : "L";
      if (current[from] <= 0) return null;
      const next = { ...current };
      next[from] -= 1;
      next[to] += 1;
      if (next[to] >= 5) return null;
      if (next.L === current.L && next.R === current.R) return null;
      return {
        L: next.L,
        R: next.R,
        from,
        to,
        label: `${handNames[from]}から${handNames[to]}へ1本移した。${current.L}-${current.R} → ${next.L}-${next.R}`
      };
    }

    function getMoveOneOptions(player) {
      return ["L", "R"].map(hand => getMoveOneOptionFrom(player, hand)).filter(Boolean);
    }

    function applyMoveOne(player, from) {
      const opt = getMoveOneOptionFrom(player, from);
      if (!opt) return false;
      state[player].L = opt.L;
      state[player].R = opt.R;
      addLog(`${handNames[player]}は「整える」を使った。${opt.label}`);
      setLastAction(player, "「整える」", `${handNames[from]}から${handNames[opt.to]}へ1本移しました。`, "card");
      clearBrokenTraps(player);
      state.mode = "attack";
      state.selectedAttackHand = null;
      setMessage(`「整える」で${handNames[from]}から${handNames[opt.to]}へ1本移しました。`);
      render();
      return true;
    }

    function updateSplitOptions() {
      const options = getSplitOptions("human");
      elements.splitLeft.innerHTML = "";
      elements.splitRight.innerHTML = "";

      for (const opt of options) {
        const optionL = document.createElement("option");
        optionL.value = `${opt.L},${opt.R}`;
        optionL.textContent = opt.L;
        elements.splitLeft.appendChild(optionL);

        const optionR = document.createElement("option");
        optionR.value = `${opt.L},${opt.R}`;
        optionR.textContent = opt.R;
        elements.splitRight.appendChild(optionR);
      }

      if (options.length === 0) {
        elements.splitHint.textContent = "今は分けられません。通常の分けるでは0の手を作れません。";
      } else {
        elements.splitHint.textContent = `合計：${state.human.L + state.human.R}。同じ形不可・0不可。`;
      }

      syncSplitSelects("left");
    }

    function syncSplitSelects(source) {
      if (source === "left") {
        elements.splitRight.value = elements.splitLeft.value;
      } else {
        elements.splitLeft.value = elements.splitRight.value;
      }
    }

    function canSetAnyTrap(player) {
      return ["L", "R"].some(h => state[player][h] > 0 && state.traps[player][h].length < 2);
    }

    function canSetAttachmentTarget(player, cardId) {
      const card = CARD_LIBRARY[cardId];
      if (!card) return false;
      if (card.curse) {
        const opponent = player === "human" ? "cpu" : "human";
        return ["L", "R"].some(h => state[opponent][h] > 0 && state.traps[opponent][h].length < 2);
      }
      if (card.blessing) return ["L", "R"].some(h => canReceiveBlessing(player, h));
      return ["L", "R"].some(h => state[player][h] > 0 && state.traps[player][h].length < 2);
    }

    function selectTrapCard(index) {
      const cardId = state.hands.human[index];
      const card = CARD_LIBRARY[cardId];
      if (!card || !isAttachmentCard(cardId) || (state.temp.human.cardActionUsed && !state.temp.human.setupMode)) return;
      if (state.temp.human.setupMode && !card.trap) {
        setMessage("仕込み中に置けるのは罠カードだけです。");
        return;
      }
      if (state.berserkerTurns.human > 0 && !state.temp.human.berserkerJustUsed) {
        setMessage("バーサーカー中はカードを設置できません。");
        return;
      }
      if (state.activeCostLimit.human !== null && card.cost > state.activeCostLimit.human) {
        setMessage("倹約令の効果で、コスト2以下のカードしか使えません。");
        return;
      }
      state.mode = state.temp.human.setupMode ? "setupTrap" : card.curse ? "setCurse" : card.blessing ? "setBlessing" : "setTrap";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = index;
      elements.splitBox.classList.remove("active");
      const target = card.curse ? "相手の手" : "自分の手";
      setMessage(`「${card.name}」を設置する${target}を選んでください。`);
      render();
    }

    async function setTrap(player, hand, handIndex, owner = player) {
      const cardId = state.hands[player][handIndex];
      const card = CARD_LIBRARY[cardId];
      if (!card || !isAttachmentCard(cardId)) return false;
      const setupActive = !!state.temp[player].setupMode;
      if (setupActive && !card.trap) return false;
      if (card.blessing && owner !== player) return false;
      if (card.curse && owner === player) return false;
      if (state.berserkerTurns[player] > 0 && !state.temp[player].berserkerJustUsed) {
        if (player === "human") setMessage("バーサーカー中はカードを設置できません。");
        return false;
      }
      if (state.activeCostLimit[player] !== null && card.cost > state.activeCostLimit[player]) {
        if (player === "human") setMessage("倹約令の効果で、コスト2以下のカードしか使えません。");
        return false;
      }
      if (state[owner][hand] <= 0 || state.traps[owner][hand].length >= 2 || (state.temp[player].cardActionUsed && !setupActive)) return false;
      if (card.blessing && hasSealCurse(owner, hand)) {
        if (player === "human") setMessage("封印の呪縛により、その手には新たに加護を置けません。");
        return false;
      }

      state.hands[player].splice(handIndex, 1);
      if (card.curse && await maybeReflectCurseWithMagicMirror(player, owner, hand, cardId)) {
        if (!setupActive) {
          state.temp[player].cardActionUsed = true;
          state.mode = "attack";
        } else {
          state.mode = "setupTrap";
        }
        state.selectedTrapCardIndex = null;
        render();
        return true;
      }

      state.traps[owner][hand].push(makeTrapInstance(cardId));
      if (!setupActive) {
        state.temp[player].cardActionUsed = true;
        state.mode = "attack";
      } else {
        state.mode = "setupTrap";
      }
      state.selectedTrapCardIndex = null;

      const label = attachmentLabel(cardId);
      const faceText = card.trap ? "伏せた" : "表向きで置いた";
      addLog(`${handNames[player]}は${handNames[owner]}の${handNames[hand]}の下に${label}「${card.name}」を${faceText}。`);
      setLastAction(player, `${label}を設置`, `${handNames[owner]}の${handNames[hand]}の下に「${card.name}」を${faceText}。`, card.trap ? "trap" : "card");
      if (player === "human") {
        if (setupActive) {
          setMessage(`「${card.name}」を${handNames[hand]}の下に伏せました。続けて罠を伏せるか、「仕込み終了」を押してください。`);
        } else {
          setMessage(`「${card.name}」を${handNames[owner]}の${handNames[hand]}の下に${faceText}。`);
        }
      }
      render();
      return true;
    }

    async function playCard(player, handIndex, showPopup = true) {
      if (state.gameOver || state.turn !== player || state.temp[player].cardActionUsed) return false;

      const cardId = state.hands[player][handIndex];
      const card = CARD_LIBRARY[cardId];
      if (!card || isAttachmentCard(cardId) || !card.canPlay(player)) return false;
      if (state.activeCostLimit[player] !== null && card.cost > state.activeCostLimit[player]) {
        if (player === "human") setMessage("倹約令の効果で、コスト2以下のカードしか使えません。");
        return false;
      }
      if (state.berserkerTurns[player] > 0 && !state.temp[player].berserkerJustUsed) {
        if (player === "human") setMessage("バーサーカー中はカードを使えません。");
        return false;
      }

      state.hands[player].splice(handIndex, 1);
      state.discard[player].push(cardId);
      state.temp[player].cardActionUsed = true;
      setLastAction(player, `「${card.name}」`, card.text, "card");

      const visibleText = `${handNames[player]}が「${card.name}」を使用：${card.text}`;
      setMessage(visibleText);
      addLog(`【カード】${visibleText}`);
      render();

      if (showPopup) await showCardPopup(player, card, false, player === "cpu" ? 760 : 520);

      await card.effect(player);
      checkWin();

      if (player === "human") {
        if (cardId === "calm" && state.mode === "moveOne") {
          setMessage("「整える」：1本移したい元の手を選んでください。");
        } else if (cardId === "repair" && state.mode === "repairDiscard") {
          setMessage("「補修」：捨てる手札を1枚選んでください。補修後、ターンは終了します。");
        } else if (cardId === "randomDice" && state.mode === "randomDice") {
          setMessage("「ランダムダイス」：本数を変える自分の0でない手を選んでください。");
        } else if (cardId === "equalTrade" && state.mode === "equalTradeSelf") {
          setMessage("「等価交換」：まず-1する自分の手を選んでください。");
        } else if (cardId === "cursedBullet" && state.mode === "cursedBullet") {
          setMessage("「凶弾」：攻撃に使う自分の手を選んでください。選ばなかった手を攻撃します。");
        } else if (cardId === "snipe" && state.mode === "snipe") {
          setMessage("「狙撃」：+1する相手の手を選んでください。");
        } else if (cardId === "rapidFire" && state.mode === "rapidFireDiscard") {
          setMessage("「乱射」：弾薬として捨てる手札を1枚選んでください。");
        } else if (cardId === "calmDown" && state.mode === "calmDownDiscard") {
          setMessage("「落ち着ける」：捨てる手札を1枚選んでください。");
        } else if (cardId === "setupTrap" && state.temp.human.setupMode) {
          setMessage("「仕込み」：罠を好きなだけ伏せられます。終わったら「仕込み終了」を押してください。");
        } else {
          setMessage(`「${card.name}」を使いました。まだ攻撃か分けるができます。`);
        }
      } else {
        setMessage(`CPUが「${card.name}」を使いました。`);
      }

      render();

      if (state.pendingTerminalEnd[player] && player === "human" && state.turn === "human") {
        state.pendingTerminalEnd[player] = false;
        await endTurn();
      }

      return true;
    }

    function getTriggerTraps(defender, targetHand, attacker, attackHand, incomingPower, timing = null, manualMode = null, extraContext = {}) {
      const candidates = [];
      for (const placedHand of ["L", "R"]) {
        state.traps[defender][placedHand].forEach((slot, index) => {
          const cardId = trapCardId(slot);
          const card = CARD_LIBRARY[cardId];
          if (!card || !card.trap) return;
          if (manualMode !== null && !!card.manual !== manualMode) return;
          if (timing !== null && (card.triggerTiming || "before") !== timing) return;
          const context = { defender, placedHand, targetHand, attacker, attackHand, incomingPower, ...extraContext };
          if (card.canTrigger(context)) {
            let priority = 1;
            if (cardId === "dodgeTrap") priority = 4;
            if (cardId === "braceTrap") priority = 3;
            if (cardId === "deflect") priority = 2;
            if (cardId === "attention") priority = 2;
            if (cardId === "swampMan") priority = 4;
            if (cardId === "counterTrap") priority = 3;
            if (cardId === "partingGift") priority = 3;
            if (cardId === "puddleTrap") priority = 2;
            if (cardId === "thornTrap") priority = 2;
            if (cardId === "baitTrap") priority = 1;
            candidates.push({ placedHand, index, cardId, card, priority });
          }
        });
      }
      candidates.sort((a, b) => b.priority - a.priority);
      return candidates;
    }

    function chooseCpuManualTrap(candidates, context) {
      if (candidates.length === 0) return null;

      const result = typeof context.resolvedFinal === "number" ? context.resolvedFinal : wrapFinger(state[context.defender][context.targetHand] + context.incomingPower);
      const wouldBreak = result === 0;
      const targetHasManyTraps = state.traps[context.defender][context.targetHand].length >= 2;

      for (const info of candidates) {
        if (info.cardId === "dodgeTrap" && (wouldBreak || context.incomingPower >= 3)) return info;
        if (info.cardId === "braceTrap" && wouldBreak) return info;
        if (info.cardId === "deflect" && (wouldBreak || targetHasManyTraps)) return info;
        if (info.cardId === "attention" && wouldBreak) return info;
        if (info.cardId === "swampMan" && state[context.attacker][context.attackHand] > state[context.defender][info.placedHand]) return info;
        if (info.cardId === "counterTrap" && state[context.defender][info.placedHand] >= 2) return info;
      }

      return Math.random() < 0.25 ? candidates[0] : null;
    }

    
    function canUseNekodamashi(defender) {
      return !state.firstTurnStarted[defender] && state.hands[defender].includes("nekodamashi");
    }

    async function askHumanNekodamashi(context) {
      return new Promise(resolve => {
        elements.trapChoiceList.innerHTML = "";
        elements.trapChoiceText.textContent = `${handNames[context.attacker]}の攻撃を「ねこだまし」で無効化しますか？`;
        const div = document.createElement("div");
        div.className = "trap-choice-card";
        div.innerHTML = `
          <div class="card-title">
            <span>「ねこだまし」</span>
            <span class="card-type">補助</span>
          </div>
          <div class="card-cost">手札から捨てて、この攻撃を無効化します。</div>
          <div class="card-text">自分の初ターンが来る前だけ使用できます。乱射も無効化できます。</div>
        `;
        const cleanup = () => {
          elements.trapChoice.classList.remove("show");
          elements.trapSkipBtn.onclick = null;
        };
        div.addEventListener("click", () => {
          cleanup();
          resolve(true);
        });
        elements.trapChoiceList.appendChild(div);
        elements.trapSkipBtn.onclick = () => {
          cleanup();
          resolve(false);
        };
        elements.trapChoice.classList.add("show");
      });
    }

    async function maybeUseNekodamashi(defender, context) {
      if (!canUseNekodamashi(defender)) return false;
      let use = false;
      if (defender === "human") {
        use = await askHumanNekodamashi(context);
      } else {
        use = true;
      }
      if (!use) return false;
      const index = state.hands[defender].indexOf("nekodamashi");
      if (index < 0) return false;
      const [cardId] = state.hands[defender].splice(index, 1);
      state.discard[defender].push(cardId);
      addLog(`${handNames[defender]}は手札から「ねこだまし」を使い、${handNames[context.attacker]}の攻撃を無効化した。`);
      setLastAction(defender, "ねこだまし", "初ターン前の攻撃を無効化しました。", "card");
      await showCardPopup(defender, CARD_LIBRARY.nekodamashi, false, defender === "cpu" ? 700 : 620);
      render();
      return true;
    }

async function maybeChooseManualTrap(defender, candidates, context) {
      if (candidates.length === 0) return null;
      if (defender === "human") {
        return await askHumanTrapChoice(candidates, context);
      }
      return chooseCpuManualTrap(candidates, context);
    }

    async function triggerTrap(defender, trapInfo, context) {
      const { placedHand, index, cardId, card } = trapInfo;
      const removedSlot = state.traps[defender][placedHand].splice(index, 1)[0];
      const removedInstanceId = trapInstanceId(removedSlot);
      if (removedInstanceId) state.revealedTrapIds.delete(removedInstanceId);
      state.discard[defender].push(cardId);
      setLastAction(defender, `「${card.name}」`, card.text, "trap");
      addLog(`【罠】${handNames[defender]}の「${card.name}」が発動。`);
      render();
      await showCardPopup(defender, card, true, 760);
      const result = await card.trigger({ ...context, defender, placedHand }) || {};
      render();
      return result;
    }

        async function addFingersWithCalculation(player, hand, amount, sourceLabel, ignoreGuard = false) {
      if (amount <= 0 || state[player][hand] <= 0) return false;
      const actual = ignoreGuard ? Math.max(1, amount) : applyGuardBlessingReduction(player, hand, amount, sourceLabel);
      const before = state[player][hand];
      const total = before + actual;
      const finalValue = normalize(total, player, hand);
      await animateCalculation(player, hand, total, finalValue);
      state[player][hand] = finalValue;
      addLog(`${sourceLabel}により、${handNames[player]}の${handNames[hand]}：${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      clearBrokenTraps(player);
      return true;
    }

    async function resolveAfterAttackBlessings(attacker, attackHand, defender, targetHand, attackTotal, canceled = false) {
      if (canceled) {
        if (hasAttachment(attacker, attackHand, "recklessBlessing") && state[attacker][attackHand] > 0) {
          await addFingersWithCalculation(attacker, attackHand, 1, "捨て身の反動");
        }
        return;
      }

      if (hasAttachment(attacker, attackHand, "growthBlessing") && attackTotal === 5) {
        drawCard(attacker);
        addLog(`${handNames[attacker]}の「成長」により、カードを1枚引いた。`);
      }

      if (hasAttachment(attacker, attackHand, "ricochetBlessing")) {
        const other = otherHand(targetHand);
        const rawDamage = Math.floor(state[attacker][attackHand] / 2);
        if (rawDamage > 0 && state[defender][other] > 0) {
          await addFingersWithCalculation(defender, other, rawDamage, "跳弾", ignoresOpponentBoardEffects(attacker));
        } else {
          addLog("「跳弾」は条件を満たしたが、ダメージが0または対象が0のため不発。");
        }
      }

      if (hasAttachment(attacker, attackHand, "recklessBlessing") && state[attacker][attackHand] > 0) {
        await addFingersWithCalculation(attacker, attackHand, 1, "捨て身の反動");
      }
    }

async function attack(attacker, attackHand, defender, targetHand) {
      if (!isAlive(attacker, attackHand) || !isAlive(defender, targetHand)) return false;

      state.animating = true;
      render();

      const basePower = state[attacker][attackHand];
      const immutable = hasImmutableCurse(attacker, attackHand);
      const rawBonus = state.temp[attacker].attackBonus || 0;
      const positiveCardBonus = Math.max(0, rawBonus);
      const negativeCardBonus = Math.min(0, rawBonus);
      const bonus = immutable ? negativeCardBonus : rawBonus;
      const berserkerBonus = immutable ? 0 : (state.berserkerTurns[attacker] > 0 ? 2 : 0);
      const blessingBonus = immutable ? 0 : (hasAttachment(attacker, attackHand, "powerBlessing") ? 1 : 0);
      const recklessBonus = immutable ? 0 : (hasAttachment(attacker, attackHand, "recklessBlessing") ? 2 : 0);
      const cursePenalty = hasAttachment(attacker, attackHand, "slowCurse") ? -1 : 0;
      let power = Math.max(1, basePower + bonus + berserkerBonus + blessingBonus + recklessBonus + cursePenalty);
      state.temp[attacker].attackBonus = 0;
      if (immutable && (positiveCardBonus > 0 || (state.berserkerTurns[attacker] > 0) || hasAttachment(attacker, attackHand, "powerBlessing") || hasAttachment(attacker, attackHand, "recklessBlessing"))) {
        addLog(`${handNames[attacker]}の${handNames[attackHand]}は「不変の呪縛」により、攻撃力増加を受けない。`);
      }
      if (blessingBonus) addLog(`${handNames[attacker]}の「力の加護」により、攻撃力+1。`);
      if (recklessBonus) addLog(`${handNames[attacker]}の「捨て身」により、攻撃力+2。`);
      if (cursePenalty) addLog(`${handNames[attacker]}の「鈍重の呪縛」により、攻撃力-1。`);
      if (ignoresOpponentBoardEffects(attacker)) {
        addLog(`${handNames[attacker]}の「強行突破」により、相手側の加護・呪縛効果を無視する。`);
      } else {
        power = applyGuardBlessingReduction(defender, targetHand, power, "攻撃");
      }

      let context = { defender, targetHand, attacker, attackHand, incomingPower: power };
      let trapUsed = false;
      let trapResult = {};

      if (await maybeUseNekodamashi(defender, context)) {
        addLog(`${handNames[attacker]}の攻撃は「ねこだまし」で無効になった。`);
        state.animating = false;
        clearHighlights();
        render();
        return true;
      }

      await animateAttackIntent(attacker, attackHand, defender, targetHand);

      // 攻撃判定前：対象変更・無効化など。強行突破中はここを封じる。
      if (state.temp[attacker].breakthrough) {
        addLog(`${handNames[attacker]}の「強行突破」により、攻撃中の相手側の罠は発動できない。`);
      } else {
        const beforeManual = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "before", true);
        const chosenBeforeManual = await maybeChooseManualTrap(defender, beforeManual, context);
        if (chosenBeforeManual) {
          trapResult = await triggerTrap(defender, chosenBeforeManual, context);
          trapUsed = true;
        } else {
          const beforeAuto = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "before", false);
          if (beforeAuto.length > 0) {
            trapResult = await triggerTrap(defender, beforeAuto[0], context);
            trapUsed = true;
          }
        }
      }

      if (typeof trapResult.powerDelta === "number") {
        const oldPower = power;
        power = Math.max(1, power + trapResult.powerDelta);
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        if (oldPower !== power) addLog(`攻撃力が${oldPower}→${power}になった。`);
      }

      if (trapResult.targetHand) {
        targetHand = trapResult.targetHand;
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        await animateAttackIntent(attacker, attackHand, defender, targetHand);
      }

      if (trapResult.cancelAttack) {
        addLog(`${handNames[attacker]}の攻撃は無効になった。`);
        setLastAction(attacker, "攻撃", "攻撃は無効になりました。", "action");
        state.animating = false;
        clearHighlights();
        render();
        return true;
      }

      if (!isAlive(defender, targetHand)) {
        addLog(`攻撃対象が0になっていたため、攻撃は失敗した。`);
        state.animating = false;
        clearHighlights();
        render();
        return true;
      }

      const before = state[defender][targetHand];
      const total = before + power;
      const overflowWouldApply = total >= 5 && hasAttachment(defender, targetHand, "overflowCurse");
      const guardWouldApply = total >= 5 && !overflowWouldApply && state.temp[defender].guard;
      let resolvedFinal = overflowWouldApply ? 0 : (guardWouldApply ? 4 : wrapFinger(total));
      if (overflowWouldApply) addLog(`${handNames[defender]}の${handNames[targetHand]}の「超過の呪縛」により、5以上は0になる。`);
      await animateCalculation(defender, targetHand, total, resolvedFinal);

      // ここでいったん攻撃判定を反映する。罠破壊は攻撃判定後罠のあと。
      state[defender][targetHand] = resolvedFinal;
      if (guardWouldApply) state.temp[defender].guard = false;
      render();

      // 攻撃判定後：囮、踏み止まりなど。
      if (!trapUsed && !state.temp[attacker].breakthrough) {
        const afterContext = { ...context, attackTotal: total, resolvedFinal };
        const afterManual = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "after", true, afterContext);
        const chosenAfterManual = await maybeChooseManualTrap(defender, afterManual, afterContext);
        if (chosenAfterManual) {
          const afterResult = await triggerTrap(defender, chosenAfterManual, afterContext);
          trapUsed = true;
          if (afterResult.stopAtFour) {
            state[defender][targetHand] = 4;
            resolvedFinal = 4;
          }
        } else {
          const afterAuto = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "after", false, afterContext);
          if (afterAuto.length > 0) {
            await triggerTrap(defender, afterAuto[0], afterContext);
            trapUsed = true;
          }
        }
      }

      setLastAction(attacker, "攻撃", `${handNames[attackHand]}で${handNames[defender]}の${handNames[targetHand]}を攻撃。`, "action");

      addLog(
        `${handNames[attacker]}の${handNames[attackHand]}${basePower}本` +
        `${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ""}${berserkerBonus ? `+${berserkerBonus}` : ""}${blessingBonus ? `+${blessingBonus}` : ""}${recklessBonus ? `+${recklessBonus}` : ""}${cursePenalty ? `${cursePenalty}` : ""}${power !== Math.max(1, basePower + bonus + berserkerBonus + blessingBonus + recklessBonus + cursePenalty) ? `→${power}` : ""}で、` +
        `${handNames[defender]}の${handNames[targetHand]}を攻撃。` +
        `${before}→${total}${total >= 5 ? `→${state[defender][targetHand]}` : ""}`
      );

      await resolveAfterAttackBlessings(attacker, attackHand, defender, targetHand, total, trapResult.cancelAttack);

      clearBrokenTraps(defender);
      clearBrokenTraps(attacker);
      state.animating = false;
      clearHighlights();
      render();
      return true;
    }

    function clearBrokenTraps(player) {
      for (const hand of ["L", "R"]) {
        if (state[player][hand] === 0 && state.traps[player][hand].length > 0) {
          const count = state.traps[player][hand].length;
          state.traps[player][hand].forEach(slot => {
            const cardId = trapCardId(slot);
            const instanceId = trapInstanceId(slot);
            if (instanceId) state.revealedTrapIds.delete(instanceId);
            if (cardId) state.discard[player].push(cardId);
          });
          state.traps[player][hand] = [];
          addLog(`${handNames[player]}の${handNames[hand]}が0になったため、その下のカード${count}枚が捨て札になった。`);
        }
      }
    }

    async function split(player, left, right, show = true) {
      const before = `${state[player].L}-${state[player].R}`;
      if (show) {
        setLastAction(player, "分ける", "左右の本数を分け直しました。", "action");
        await showPopup(player, "分ける", "左右の本数を分け直しました。", "action", player === "cpu" ? 650 : 500);
      }
      state[player].L = left;
      state[player].R = right;
      addLog(`${handNames[player]}が分ける。${before} → ${left}-${right}`);
      clearBrokenTraps(player);
      render();
    }

        async function resolveEndTurnCurses(player) {
      for (const hand of ["L", "R"]) {
        if (state[player][hand] <= 0) continue;
        const weaknessSlots = state.traps[player][hand].filter(slot => trapCardId(slot) === "weaknessCurse");
        if (weaknessSlots.length === 0) continue;

        let activeCount = 0;
        for (const slot of weaknessSlots) {
          if (typeof slot.waitTurns === "number" && slot.waitTurns > 0) {
            slot.waitTurns -= 1;
            addLog(`${handNames[player]}の${handNames[hand]}の「衰弱の呪縛」は待機中。次から発動する。`);
          } else {
            activeCount += 1;
          }
        }

        for (let i = 0; i < activeCount; i++) {
          if (state[player][hand] <= 0) break;
          const before = state[player][hand];
          state[player][hand] = Math.max(0, before - 1);
          addLog(`${handNames[player]}の${handNames[hand]}の「衰弱の呪縛」により、ターン終了時に${before}→${state[player][hand]}。`);
          await animateCalculation(player, hand, state[player][hand], state[player][hand]);
          if (state[player][hand] === 0) {
            clearBrokenTraps(player);
            break;
          }
        }
      }
      render();
    }

async function endTurn() {
      if (checkWin()) {
        render();
        return;
      }

      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingSwapFirst = null;
      elements.splitBox.classList.remove("active");

      await resolveEndTurnCurses(state.turn);
      if (checkWin()) {
        render();
        return;
      }

      if (state.berserkerTurns[state.turn] > 0) state.berserkerTurns[state.turn] -= 1;
      state.activeCostLimit[state.turn] = null;
      state.noSplit[state.turn] = false;
      const next = state.turn === "human" ? "cpu" : "human";

      if (next === "cpu") {
        state.turn = "cpu";
        setMessage("CPUの番です。");
        render();
        await delay(450);
        await startTurn("cpu");
        await delay(550);
        await cpuTurn();
      } else {
        state.turnNumber += 1;
        await startTurn("human");
      }
    }

    function checkWin() {
      if (isDead("cpu")) {
        state.gameOver = true;
        setMessage("勝利！ CPUの両手を0にしました。");
        addLog("あなたの勝ち！");
        return true;
      }

      if (isDead("human")) {
        state.gameOver = true;
        setMessage("敗北…。あなたの両手が0になりました。");
        addLog("CPUの勝ち。");
        return true;
      }

      return false;
    }

    const CPU_DIFFICULTY_CONFIG = {
      easy: { label: "やさしめ", topN: 6, noise: 90, skipCardChance: 0.35, mistakeChance: 0.18, trapCaution: 0.75 },
      standard: { label: "標準", topN: 3, noise: 35, skipCardChance: 0.12, mistakeChance: 0.06, trapCaution: 1.0 },
      hard: { label: "強め", topN: 2, noise: 12, skipCardChance: 0.03, mistakeChance: 0.01, trapCaution: 1.25 }
    };

    function cpuConfig() {
      return CPU_DIFFICULTY_CONFIG[state.cpuDifficulty] || CPU_DIFFICULTY_CONFIG.standard;
    }

    function cpuDeckProfile() {
      const counts = currentDeckCounts("cpu");
      let total = 0, traps = 0, bullets = 0, shooting = 0, defense = 0;
      for (const [cardId, qtyRaw] of Object.entries(counts)) {
        const qty = Number(qtyRaw) || 0;
        const card = CARD_LIBRARY[cardId];
        if (!card || qty <= 0) continue;
        total += qty;
        if (card.trap) traps += qty;
        if (card.blessing || card.curse) defense += Math.ceil(qty / 2);
        if (card.bullet || ["rapidFire", "bulletSupply", "reload", "focusedShot", "snipe"].includes(cardId)) bullets += qty;
        if (["rapidFire", "snipe", "bulletSupply", "reload", "focusedShot", "accelBullet", "specialBullet", "pierceBullet"].includes(cardId)) shooting += qty;
        if (card.trap || ["repair", "guard", "calm", "lockSplit"].includes(cardId)) defense += qty;
      }
      return {
        total: Math.max(1, total),
        trapBias: traps / Math.max(1, total),
        bulletBias: bullets / Math.max(1, total),
        shootingBias: shooting / Math.max(1, total),
        defenseBias: defense / Math.max(1, total)
      };
    }

    function chooseScoredCpuOption(options, purpose = "move") {
      if (!options.length) return null;
      const cfg = cpuConfig();
      const prepared = options
        .filter(opt => Number.isFinite(opt.score))
        .map(opt => ({ ...opt, rollScore: opt.score + (Math.random() * cfg.noise) - cfg.noise / 2 }))
        .sort((a, b) => b.rollScore - a.rollScore);

      if (!prepared.length) return null;

      if (Math.random() < cfg.mistakeChance && prepared.length > 1) {
        const pool = prepared.slice(Math.min(1, prepared.length - 1), Math.min(prepared.length, cfg.topN + 2));
        return pool[Math.floor(Math.random() * pool.length)];
      }

      const top = prepared.slice(0, Math.min(cfg.topN, prepared.length));
      return top[Math.floor(Math.random() * top.length)];
    }

    function cpuCanUseCardIndex(id) {
      const index = state.hands.cpu.findIndex(cardId => cardId === id);
      if (index < 0) return -1;
      const card = CARD_LIBRARY[id];
      if (!card || isAttachmentCard(id) || !card.canPlay("cpu")) return -1;
      if (state.activeCostLimit.cpu !== null && card.cost > state.activeCostLimit.cpu) return -1;
      return index;
    }

    function wouldCpuWinByZeroing(hand) {
      return state.human[otherHand(hand)] === 0;
    }

    function cpuBestAttackScoreAfterBonus(extraBonus = 0) {
      let best = null;
      for (const a of ["L", "R"].filter(h => isAlive("cpu", h))) {
        for (const t of ["L", "R"].filter(h => isAlive("human", h))) {
          const immutable = hasImmutableCurse("cpu", a);
          const power = Math.max(1, state.cpu[a] + (immutable ? Math.min(0, state.temp.cpu.attackBonus + extraBonus) : state.temp.cpu.attackBonus + extraBonus) + (immutable ? 0 : (state.berserkerTurns.cpu > 0 ? 2 : 0)) + (immutable ? 0 : (hasAttachment("cpu", a, "powerBlessing") ? 1 : 0)) + (immutable ? 0 : (hasAttachment("cpu", a, "recklessBlessing") ? 2 : 0)) - (hasAttachment("cpu", a, "slowCurse") ? 1 : 0) - (hasAttachment("human", t, "guardBlessing") ? 1 : 0));
          const result = wrapFinger(state.human[t] + power);
          let score = 20 + state.human[t] * 8 + state.cpu[a] * 2;
          if (result === 0) score += wouldCpuWinByZeroing(t) ? 10000 : 520;
          if (state.human[t] === 4) score += 120;
          score -= state.traps.human[t].length * 35 * cpuConfig().trapCaution;
          if (!best || score > best.score) best = { a, t, result, score };
        }
      }
      return best;
    }

    function cpuThreatScoreForHands(L = state.cpu.L, R = state.cpu.R) {
      let score = 0;
      const values = { L, R };
      for (const h of ["L", "R"]) {
        if (values[h] <= 0) {
          score += 70;
          continue;
        }
        for (const enemy of ["L", "R"]) {
          if (state.human[enemy] <= 0) continue;
          if (wrapFinger(values[h] + state.human[enemy]) === 0) score += 120;
        }
        if (values[h] === 4) score += 45;
      }
      return score;
    }

    function cpuBestRapidFireAmmo() {
      let best = null;
      state.hands.cpu.forEach((cardId, index) => {
        if (cardId === "rapidFire") return;
        const card = CARD_LIBRARY[cardId];
        if (!card) return;
        let damage = (card.cost || 0) + (card.bullet ? 1 : 0);
        let score = damage * 90;
        if (cardId === "logicCrusherBullet") score = 9500;
        if (card.bullet) score += 85;
        if (cardId === "specialBullet") score += 120;
        if (cardId === "pierceBullet") score += (state.traps.human.L.length + state.traps.human.R.length) > 0 ? 180 : 40;
        if (cardId === "accelBullet") score += 60;
        for (const t of ["L", "R"].filter(h => state.human[h] > 0)) {
          const result = cardId === "logicCrusherBullet" ? 0 : wrapFinger(state.human[t] + damage);
          let targetScore = score + state.human[t] * 10 - state.traps.human[t].length * 20;
          if (result === 0) targetScore += wouldCpuWinByZeroing(t) ? 10000 : 500;
          if (!best || targetScore > best.score) best = { index, cardId, target: t, damage, score: targetScore };
        }
      });
      return best;
    }

    function cpuBestTrapPlacementScore() {
      const profile = cpuDeckProfile();
      let best = null;
      state.hands.cpu.forEach((cardId, index) => {
        const card = CARD_LIBRARY[cardId];
        if (!isAttachmentCard(cardId)) return;
        if (state.temp.cpu.setupMode && !card.trap) return;
        if (state.activeCostLimit.cpu !== null && card.cost > state.activeCostLimit.cpu) return;
        const owner = card.curse ? "human" : "cpu";
        for (const hand of ["L", "R"]) {
          if (state[owner][hand] <= 0 || state.traps[owner][hand].length >= 2) continue;
          let score = 30 + profile.trapBias * 160 - state.traps[owner][hand].length * 40;
          if (card.trap) {
            if (state.cpu[hand] === 4) score += 210;
            if (state.cpu[hand] === 3) score += 65;
            if (["dodgeTrap", "braceTrap", "puddleTrap"].includes(cardId)) score += state.cpu[hand] >= 3 ? 120 : 40;
            if (["deflect", "attention"].includes(cardId)) score += state.cpu[otherHand(hand)] > 0 ? 70 : -40;
            if (["thornTrap", "counterTrap", "swampMan"].includes(cardId)) score += state.cpu[hand] >= 2 ? 70 : 15;
            if (cardId === "baitTrap") score += 35;
          if (cardId === "escapeDevice") score += (state.cpu[hand] > 0 && state.cpu[otherHand(hand)] === 0) ? 260 : 40;
          if (cardId === "magicMirror") score += state.hands.human.some(id => CARD_LIBRARY[id]?.curse) ? 180 : 70;
          }
          if (cardId === "powerBlessing") score += state.cpu[hand] >= 2 ? 170 : 80;
          if (cardId === "guardBlessing") score += state.cpu[hand] >= 3 ? 190 : 100;
          if (cardId === "growthBlessing") score += state.cpu[hand] >= 2 ? 120 : 50;
          if (cardId === "recklessBlessing") score += state.cpu[hand] <= 3 ? 190 : -40;
          if (cardId === "ricochetBlessing") score += state.cpu[hand] >= 2 ? 170 : 30;
          if (cardId === "slowCurse") score += state.human[hand] >= 2 ? 180 : 80;
          if (cardId === "weaknessCurse") score += state.human[hand] <= 2 ? 210 : 120;
          if (cardId === "immutableCurse") score += hasAttachment("human", hand, "powerBlessing") || hasAttachment("human", hand, "recklessBlessing") ? 230 : 90;
          if (cardId === "sealCurse") score += state.traps.human[hand].some(slot => isBlessingCard(trapCardId(slot))) ? 160 : 100;
          if (cardId === "exposeCurse") score += state.traps.human[hand].some(slot => isTrapCard(trapCardId(slot))) ? 210 : 70;
          if (!best || score > best.score) best = { index, hand, owner, score, cardId };
        }
      });
      return best;
    }

    async function chooseCpuCardAction() {
      if (state.temp.cpu.cardActionUsed) return false;
      if (state.berserkerTurns.cpu > 0 && !state.temp.cpu.berserkerJustUsed) return false;

      const cfg = cpuConfig();
      const profile = cpuDeckProfile();
      const candidates = [];

      const addCard = (id, score, note = "") => {
        const index = cpuCanUseCardIndex(id);
        if (index >= 0) candidates.push({ id, index, score, note, action: async () => playCard("cpu", index, true) });
      };

      const bestNormal = cpuBestAttackScoreAfterBonus(0);
      const bestStrong = cpuBestAttackScoreAfterBonus(1);

      if (bestStrong && bestStrong.score > (bestNormal?.score || 0) + 120) addCard("strongHit", bestStrong.score + 60, "攻撃強化");
      if (state.hands.cpu.includes("lightHit")) {
        let lightScore = 80;
        for (const a of ["L", "R"].filter(h => isAlive("cpu", h))) {
          for (const t of ["L", "R"].filter(h => isAlive("human", h))) {
            const normal = wrapFinger(state.human[t] + state.cpu[a]);
            const lighter = wrapFinger(state.human[t] + Math.max(1, state.cpu[a] - 1));
            if (normal !== 0 && lighter === 0) lightScore += wouldCpuWinByZeroing(t) ? 9000 : 430;
            if (normal === 0 && lighter !== 0) lightScore -= 220;
          }
        }
        addCard("lightHit", lightScore, "軽打調整");
      }

      if (state.decks.cpu.some(id => CARD_LIBRARY[id]?.blessing || CARD_LIBRARY[id]?.curse)) addCard("prayer", 170 + profile.defenseBias * 140, "祈祷");
      if (hasOwnCurse("cpu")) addCard("dispelCurse", 330, "解呪");
      if (hasSwapTargets("cpu")) addCard("swapAttachment", 260, "すりかえ");
      if (state.cpu.L === 0 || state.cpu.R === 0) addCard("repair", 780 + (state.cpu.L === 0 && state.cpu.R === 0 ? 300 : 0), "復帰");
      if (cpuThreatScoreForHands() >= 120) addCard("guard", 300 + cpuThreatScoreForHands(), "防御");
      if (state.hands.cpu.length >= 5) addCard("calmDown", 180 + state.hands.cpu.length * 25, "手札整理");
      if (state.turnNumber <= 8 && state.activeAcceleration.cpu === 0 && state.pendingAcceleration.cpu === 0 && state.activeNoDraw.cpu === 0) addCard("acceleration", 260 + Math.max(0, 8 - state.turnNumber) * 15, "過加速");
      if (getSplitOptions("human").length > 0) addCard("lockSplit", 180 + (state.human.L === 4 || state.human.R === 4 ? 90 : 0), "固定");

      if (state.hands.cpu.includes("rapidFire")) {
        const ammo = cpuBestRapidFireAmmo();
        if (ammo) addCard("rapidFire", ammo.score + profile.shootingBias * 260, "乱射");
      }
      if (state.hands.cpu.filter(id => CARD_LIBRARY[id]?.bullet).length <= 1) addCard("bulletSupply", 210 + profile.bulletBias * 340, "弾補給");
      if (state.discard.cpu.includes("rapidFire")) addCard("reload", 260 + profile.bulletBias * 310, "乱射回収");
      if (state.hands.cpu.includes("rapidFire") && !state.hands.cpu.includes("logicCrusherBullet")) addCard("focusedShot", 420 + profile.bulletBias * 360, "必殺弾");
      if (["L", "R"].some(h => state.human[h] === 4)) addCard("snipe", wouldCpuWinByZeroing(["L", "R"].find(h => state.human[h] === 4)) ? 10000 : 560, "狙撃");
      if (CARD_LIBRARY.equalTrade.canPlay("cpu")) addCard("equalTrade", 160 + (state.human.L >= 3 || state.human.R >= 3 ? 120 : 0), "等価交換");
      if (CARD_LIBRARY.doubleDouble.canPlay("cpu")) addCard("doubleDouble", 320 + (bestNormal?.score || 0) / 4, "追加行動");
      if (state.cpu.L === 4 || state.cpu.R === 4) addCard("randomDice", state.cpuDifficulty === "easy" ? 170 : 80, "賭け");
      if (state.hands.cpu.filter(id => CARD_LIBRARY[id]?.trap).length <= 1) addCard("battlePrep", 160 + profile.trapBias * 280, "罠補充");
      if ((state.traps.human.L.length + state.traps.human.R.length) >= 1) {
        addCard("revealTrap", 130 + profile.defenseBias * 70, "看破");
        addCard("removeTrap", 220 + (state.traps.human.L.length + state.traps.human.R.length) * 80, "解除");
        addCard("pullTrap", 150 + profile.defenseBias * 90, "手繰り寄せ");
      }
      if ((state.traps.human.L.length + state.traps.human.R.length) >= 1 && bestNormal && bestNormal.score > 260) addCard("breakthrough", 260 + bestNormal.score / 3, "罠突破");
      if (state.hands.cpu.filter(id => CARD_LIBRARY[id]?.trap).length >= 2 && canSetAnyTrap("cpu")) addCard("setupTrap", 250 + profile.trapBias * 450, "仕込み");
      if (state.cpu.L > 0 && state.cpu.R > 0 && state.cpu.L + state.cpu.R === 5) addCard("cursedBullet", 250, "凶弾");
      if (bestNormal && bestNormal.score < 30) addCard("passCard", 10, "パス");
      if (state.human.L + state.human.R >= 6) addCard("thriftLaw", 150, "倹約令");
      if (state.cpu.L >= 2 && state.cpu.R >= 2 && state.human.L + state.human.R >= 5) addCard("berserker", 180, "バーサーカー");

      const trap = cpuBestTrapPlacementScore();
      if (trap) {
        candidates.push({
          id: "setTrap",
          index: trap.index,
          score: trap.score,
          note: "罠設置",
          action: async () => await setTrap("cpu", trap.hand, trap.index, trap.owner || "cpu")
        });
      }

      if (!candidates.length || Math.random() < cfg.skipCardChance) return false;

      const chosen = chooseScoredCpuOption(candidates, "card");
      if (!chosen || chosen.score < (state.cpuDifficulty === "hard" ? 80 : state.cpuDifficulty === "standard" ? 45 : -50)) return false;
      return await chosen.action();
    }

    async function chooseCpuTrapSet() {
      const trap = cpuBestTrapPlacementScore();
      if (!trap) return false;
      return await setTrap("cpu", trap.hand, trap.index, trap.owner || "cpu");
    }

    function chooseCpuMove() {
      const cfg = cpuConfig();
      const attacks = [];
      for (const a of ["L", "R"].filter(h => isAlive("cpu", h))) {
        for (const t of ["L", "R"].filter(h => isAlive("human", h))) {
          const immutable = hasImmutableCurse("cpu", a);
          const power = Math.max(1, state.cpu[a] + (immutable ? Math.min(0, state.temp.cpu.attackBonus) : state.temp.cpu.attackBonus) + (immutable ? 0 : (state.berserkerTurns.cpu > 0 ? 2 : 0)) + (immutable ? 0 : (hasAttachment("cpu", a, "powerBlessing") ? 1 : 0)) + (immutable ? 0 : (hasAttachment("cpu", a, "recklessBlessing") ? 2 : 0)) - (hasAttachment("cpu", a, "slowCurse") ? 1 : 0) - (hasAttachment("human", t, "guardBlessing") ? 1 : 0));
          const result = wrapFinger(state.human[t] + power);
          let score = 25 + state.human[t] * 8 + state.cpu[a] * 3;

          if (result === 0) score += wouldCpuWinByZeroing(t) ? 10000 : 620;
          if (state.human[t] === 4) score += 160;
          if (state.human[t] === 1 && result !== 0) score -= 40;
          score -= state.traps.human[t].length * 42 * cfg.trapCaution;
          if (state.temp.cpu.attackBonus > 0 && result === 0) score += 140;
          attacks.push({ type: "attack", a, t, score });
        }
      }

      const currentThreat = cpuThreatScoreForHands();
      const splits = (state.noSplit.cpu || state.berserkerTurns.cpu > 0) ? [] : getSplitOptions("cpu").map(opt => {
        let score = 35;
        const values = [opt.L, opt.R];
        const newThreat = cpuThreatScoreForHands(opt.L, opt.R);
        score += (currentThreat - newThreat) * 1.8;
        if (!values.includes(0)) score += 25;
        if (values.includes(4)) score -= 35;
        if (opt.L === opt.R) score += 28;
        if (Math.max(opt.L, opt.R) >= 3) score += 12;
        if (state.temp.cpu.attackBonus > 0) score -= 220;
        if (currentThreat < 80) score -= 40;
        return { type: "split", L: opt.L, R: opt.R, score };
      });

      const allMoves = attacks.concat(splits);
      if (allMoves.length === 0) return null;

      const chosen = chooseScoredCpuOption(allMoves, "move");
      return chosen;
    }

    async function cpuExtraAction() {
      if (state.gameOver || state.turn !== "cpu") return;
      const move = chooseCpuMove();
      if (!move) {
        await endTurn();
        return;
      }
      if (move.type === "attack") {
        await attack("cpu", move.a, "human", move.t);
      } else {
        await split("cpu", move.L, move.R, true);
      }
      await delay(300);
      await resolveActionDone();
    }

    async function cpuTurn() {
      if (state.gameOver) return;

      const usedAction = await chooseCpuCardAction();

      if (usedAction) {
        setMessage(usedAction === "setup" ? "CPUが仕込みを終えました。" : "CPUがカード関連行動を行いました。");
        render();
        await delay(700);
      }

      if (usedAction === "setup") {
        state.temp.cpu.setupMode = false;
        await endTurn();
        return;
      }

      if (state.pendingTerminalEnd.cpu) {
        state.pendingTerminalEnd.cpu = false;
        await endTurn();
        return;
      }

      const move = chooseCpuMove();

      if (!move) {
        setMessage("CPUは行動できません。");
        await endTurn();
        return;
      }

      if (move.type === "attack") {
        await attack("cpu", move.a, "human", move.t);
      } else {
        await split("cpu", move.L, move.R, true);
      }

      await delay(300);
      await resolveActionDone();
    }

    async function applyCursedBullet(player, attackHand) {
      if (state[player].L <= 0 || state[player].R <= 0) return false;
      if (state[player][attackHand] <= 0) return false;

      const targetHand = otherHand(attackHand);
      const opponent = player === "human" ? "cpu" : "human";
      const before = state[player][targetHand];
      const rawPower = state[player][attackHand];
      const power = applyGuardBlessingReduction(player, targetHand, rawPower, "凶弾");
      const total = before + power;
      const finalValue = normalize(total, player, targetHand);

      state.animating = true;
      render();
      await animateAttackIntent(player, attackHand, player, targetHand);
      await animateCalculation(player, targetHand, total, finalValue);

      state[player][targetHand] = finalValue;
      addLog(`${handNames[player]}は「凶弾」で、自分の${handNames[attackHand]}${rawPower}本を使い、${handNames[targetHand]}に${power}本加えた。${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);

      if (total === 5) {
        const targets = ["L", "R"].filter(h => state[opponent][h] > 0);
        addLog(`「凶弾」の追加効果。${handNames[opponent]}の1以上の手に3本ずつ加える。`);
        for (const h of targets) {
          const ob = state[opponent][h];
          const amount = applyGuardBlessingReduction(opponent, h, 3, "凶弾の追加効果");
          const ot = ob + amount;
          const of = normalize(ot, opponent, h);
          await animateCalculation(opponent, h, ot, of);
          state[opponent][h] = of;
          addLog(`${handNames[opponent]}の${handNames[h]}：${ob}→${ot}${ot >= 5 ? `→${of}` : ""}`);
        }
        if (targets.length === 0) addLog("対象になる1以上の手がなかったため、凶弾の追加効果は不発。");
      }

      clearBrokenTraps(player);
      clearBrokenTraps(opponent);
      state.animating = false;
      clearHighlights();
      state.mode = "attack";
      state.pendingTerminalEnd[player] = true;
      render();
      return true;
    }

    function canTriggerAgainstRapidFire(cardId) {
      return ["dodgeTrap", "deflect", "attention", "braceTrap", "baitTrap", "puddleTrap", "partingGift", "escapeDevice"].includes(cardId);
    }

    async function applyRapidFire(player, defender, discardIndex, targetHand) {
      if (state[defender][targetHand] <= 0) return false;
      const cardId = state.hands[player][discardIndex];
      const ammo = CARD_LIBRARY[cardId];
      if (!ammo || cardId === "rapidFire") return false;

      if (await maybeUseNekodamashi(defender, { defender, targetHand, attacker: player, attackHand: null, incomingPower: 0, isRapidFire: true })) {
        addLog(`${handNames[player]}の乱射は「ねこだまし」で無効になった。`);
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        render();
        return true;
      }

      const [discarded] = state.hands[player].splice(discardIndex, 1);
      state.discard[player].push(discarded);

      if (discarded === "logicCrusherBullet") {
        state.animating = true;
        render();
        await showPopup(player, "乱射：ロジックアトリエ", `罠を発動させず、${handNames[defender]}の${handNames[targetHand]}を0にします。`, "action", 900);
        const before = state[defender][targetHand];
        await animateCalculation(defender, targetHand, before, 0);
        state[defender][targetHand] = 0;
        addLog(`${handNames[player]}は「乱射」で「ロジックアトリエ」を捨て、${handNames[defender]}の${handNames[targetHand]}を${before}→0にした。罠は発動できない。`);
        clearBrokenTraps(defender);
        state.animating = false;
        clearHighlights();
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        render();
        return true;
      }

      let damage = (ammo.cost || 0) + (ammo.bullet ? 1 : 0);
      damage = applyGuardBlessingReduction(defender, targetHand, damage, "乱射");
      if (damage <= 0) {
        addLog(`${handNames[player]}は「乱射」で「${ammo.name}」を捨てたが、ダメージは0だった。`);
        await handleCardDiscardEffect(player, discarded);
        state.pendingTerminalEnd[player] = true;
        render();
        return true;
      }

      state.animating = true;
      render();

      let context = { defender, targetHand, attacker: player, attackHand: null, incomingPower: damage, isRapidFire: true };
      let trapUsed = false;
      let trapResult = {};

      await showPopup(player, "乱射", `「${ammo.name}」を捨てて${damage}ダメージ。`, "action", 650);

      const beforeManual = getTriggerTraps(defender, targetHand, player, null, damage, "before", true, context)
        .filter(info => canTriggerAgainstRapidFire(info.cardId));
      const chosenBeforeManual = await maybeChooseManualTrap(defender, beforeManual, context);
      if (chosenBeforeManual) {
        trapResult = await triggerTrap(defender, chosenBeforeManual, context);
        trapUsed = true;
      } else {
        const beforeAuto = getTriggerTraps(defender, targetHand, player, null, damage, "before", false, context)
          .filter(info => canTriggerAgainstRapidFire(info.cardId));
        if (beforeAuto.length > 0) {
          trapResult = await triggerTrap(defender, beforeAuto[0], context);
          trapUsed = true;
        }
      }

      if (typeof trapResult.powerDelta === "number") {
        const oldDamage = damage;
        damage = Math.max(1, damage + trapResult.powerDelta);
        context = { defender, targetHand, attacker: player, attackHand: null, incomingPower: damage, isRapidFire: true };
        if (oldDamage !== damage) addLog(`乱射のダメージが${oldDamage}→${damage}になった。`);
      }

      if (trapResult.targetHand) {
        targetHand = trapResult.targetHand;
        context = { defender, targetHand, attacker: player, attackHand: null, incomingPower: damage, isRapidFire: true };
      }

      if (trapResult.cancelAttack) {
        addLog(`${handNames[player]}の乱射は無効になった。`);
        state.animating = false;
        await handleCardDiscardEffect(player, discarded);
        state.pendingTerminalEnd[player] = true;
        clearHighlights();
        render();
        return true;
      }

      const before = state[defender][targetHand];
      const total = before + damage;
      const resolvedFinal = normalize(total, defender, targetHand);
      await animateCalculation(defender, targetHand, total, resolvedFinal);
      state[defender][targetHand] = resolvedFinal;
      render();

      if (!trapUsed) {
        const afterContext = { ...context, attackTotal: total, resolvedFinal };
        const afterManual = getTriggerTraps(defender, targetHand, player, null, damage, "after", true, afterContext)
          .filter(info => canTriggerAgainstRapidFire(info.cardId));
        const chosenAfterManual = await maybeChooseManualTrap(defender, afterManual, afterContext);
        if (chosenAfterManual) {
          const afterResult = await triggerTrap(defender, chosenAfterManual, afterContext);
          trapUsed = true;
          if (afterResult.stopAtFour) state[defender][targetHand] = 4;
        } else {
          const afterAuto = getTriggerTraps(defender, targetHand, player, null, damage, "after", false, afterContext)
            .filter(info => canTriggerAgainstRapidFire(info.cardId));
          if (afterAuto.length > 0) {
            await triggerTrap(defender, afterAuto[0], afterContext);
            trapUsed = true;
          }
        }
      }

      addLog(`${handNames[player]}は「乱射」で「${ammo.name}」を捨て、${handNames[defender]}の${handNames[targetHand]}に${damage}ダメージ。${before}→${total}${total >= 5 ? `→${state[defender][targetHand]}` : ""}`);
      await handleCardDiscardEffect(player, discarded);

      clearBrokenTraps(defender);
      state.animating = false;
      clearHighlights();
      state.pendingTerminalEnd[player] = true;
      state.mode = "attack";
      render();
      return true;
    }

    async function chooseCalmDownDiscard(index) {
      if (state.mode !== "calmDownDiscard") return;
      const cardId = state.hands.human[index];
      if (!cardId || cardId === "calmDown") {
        setMessage("落ち着ける自身は捨てられません。別の手札を選んでください。");
        return;
      }
      const [discarded] = state.hands.human.splice(index, 1);
      state.discard.human.push(discarded);
      await handleCardDiscardEffect("human", discarded);
      drawCard("human");
      drawCard("human");
      state.mode = "attack";
      addLog(`あなたは「落ち着ける」で「${CARD_LIBRARY[discarded].name}」を捨て、2枚引いた。`);
      setMessage(`「落ち着ける」：「${CARD_LIBRARY[discarded].name}」を捨て、2枚引きました。まだ攻撃か分けるができます。`);
      render();
    }

    function chooseRapidFireDiscard(index) {
      if (state.mode !== "rapidFireDiscard") return;
      const cardId = state.hands.human[index];
      if (!cardId || cardId === "rapidFire") {
        setMessage("乱射自身は捨てられません。別の手札を選んでください。");
        return;
      }
      state.pendingRapidFireDiscard = index;
      state.mode = "rapidFireTarget";
      setMessage(`「${CARD_LIBRARY[cardId].name}」を弾薬にします。次に攻撃する相手の手を選んでください。`);
      render();
    }

    async function chooseRepairDiscard(index) {
      if (state.mode !== "repairDiscard") return;
      const cardId = state.hands.human[index];
      if (!cardId || cardId === "repair") {
        setMessage("補修自身は捨てられません。別の手札を選んでください。");
        return;
      }
      const [discarded] = state.hands.human.splice(index, 1);
      state.discard.human.push(discarded);
      await handleCardDiscardEffect("human", discarded);
      state.pendingRepairDiscard = discarded;
      state.mode = "repair";
      setMessage(`「${CARD_LIBRARY[discarded].name}」を捨てました。次に1に戻す0の手を選んでください。`);
      render();
    }

    async function resolveActionDone() {
      if (state.extraActions[state.turn] > 0 && !checkWin()) {
        state.extraActions[state.turn] -= 1;
        state.selectedAttackHand = null;
        state.mode = "attack";
        elements.splitBox.classList.remove("active");
        setMessage(`${handNames[state.turn]}は追加行動できます。もう一度、攻撃か分けるを選んでください。`);
        render();
        if (state.turn === "cpu") {
          await delay(500);
          await cpuExtraAction();
        }
        return;
      }
      await endTurn();
    }

    async function applyRandomDice(player, hand) {
      if (state[player][hand] <= 0) return false;
      const before = state[player][hand];
      const next = Math.floor(Math.random() * 5);

      state.highlight = { player, hand, type: "roulette" };
      render();
      await showRoulettePopup(player, hand, next);

      state[player][hand] = next;
      addLog(`${handNames[player]}は「ランダムダイス」で${handNames[hand]}を${before}→${next}にした。`);
      setLastAction(player, "ランダムダイス", `${handNames[hand]}が${before}→${next}になりました。`, "card");
      clearBrokenTraps(player);
      state.highlight = null;
      if (player === "human") {
        state.mode = "attack";
        setMessage(`「ランダムダイス」：${handNames[hand]}が${before}→${next}になりました。まだ攻撃か分けるができます。`);
      }
      render();
      return true;
    }

    function applyEqualTradeSelf(player, hand) {
      if (state[player][hand] <= 0) return false;
      state[player][hand] = Math.max(0, state[player][hand] - 1);
      clearBrokenTraps(player);
      state.pendingEqualTradeSelf = hand;
      state.mode = "equalTradeOpponent";
      setMessage(`自分の${handNames[hand]}を-1しました。次に-1する相手の手を選んでください。`);
      render();
      return true;
    }

    function applyEqualTradeOpponent(player, opponent, hand) {
      if (state[opponent][hand] < 2) return false;
      state[opponent][hand] = Math.max(0, state[opponent][hand] - 1);
      clearBrokenTraps(opponent);
      addLog(`${handNames[player]}は「等価交換」で、自分の${handNames[state.pendingEqualTradeSelf] || "手"}と${handNames[opponent]}の${handNames[hand]}を-1した。`);
      state.pendingEqualTradeSelf = null;
      state.mode = "attack";
      setMessage(`「等価交換」：相手の${handNames[hand]}を-1しました。まだ攻撃か分けるができます。`);
      render();
      return true;
    }

    function applyCpuEqualTrade() {
      const selfChoices = ["L", "R"].filter(h => state.cpu[h] > 0);
      const oppChoices = ["L", "R"].filter(h => state.human[h] >= 2);
      if (!selfChoices.length || !oppChoices.length) return false;
      selfChoices.sort((a, b) => state.cpu[b] - state.cpu[a]);
      oppChoices.sort((a, b) => state.human[a] - state.human[b]);
      const selfHand = selfChoices[0];
      const oppHand = oppChoices[0];
      state.cpu[selfHand] = Math.max(0, state.cpu[selfHand] - 1);
      state.human[oppHand] = Math.max(0, state.human[oppHand] - 1);
      clearBrokenTraps("cpu");
      clearBrokenTraps("human");
      addLog(`CPUは「等価交換」で、自分の${handNames[selfHand]}とあなたの${handNames[oppHand]}を-1した。`);
      return true;
    }

    async function onHandClick(event) {
      const card = event.currentTarget;
      const owner = card.dataset.owner;
      const hand = card.dataset.hand;

      if (state.gameOver || state.animating || state.turn !== "human") return;

      if (state.mode === "chooseOpponentTrap") {
        setMessage(state.pendingTrapTargetEffect === "remove"
          ? "解除する相手の伏せカードをタップしてください。"
          : state.pendingTrapTargetEffect === "move"
            ? "移動させる相手の伏せカードをタップしてください。"
            : "確認する相手の伏せカードをタップしてください。");
        return;
      }

      if (state.mode === "repair") {
        if (owner !== "human") {
          setMessage("自分の0の手を選んでください。");
          return;
        }
        if (state.human[hand] !== 0) {
          setMessage("補修できるのは0の手だけです。");
          return;
        }
        state.human[hand] = 1;
        state.mode = "attack";
        const discarded = state.pendingRepairDiscard;
        state.pendingRepairDiscard = null;
        addLog(`あなたは「補修」で${discarded ? `「${CARD_LIBRARY[discarded].name}」を捨て、` : ""}${handNames[hand]}を0→1に戻した。ターン終了。`);
        setMessage(`「補修」：${handNames[hand]}を1に戻しました。ターンを終了します。`);
        render();
        await endTurn();
        return;
      }

      if (state.mode === "repairDiscard") {
        setMessage("補修で捨てる手札を1枚選んでください。");
        return;
      }

      if (state.mode === "randomDice") {
        if (owner !== "human") {
          setMessage("自分の手を選んでください。");
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("0の手にはランダムダイスを使えません。");
          return;
        }
        await applyRandomDice("human", hand);
        return;
      }

      if (state.mode === "equalTradeSelf") {
        if (owner !== "human") {
          setMessage("まず自分の0でない手を選んでください。");
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("0の手は選べません。");
          return;
        }
        applyEqualTradeSelf("human", hand);
        return;
      }

      if (state.mode === "equalTradeOpponent") {
        if (owner !== "cpu") {
          setMessage("次に相手の2以上の手を選んでください。");
          return;
        }
        if (state.cpu[hand] < 2) {
          setMessage("等価交換では、相手の1以下の手は選べません。");
          return;
        }
        applyEqualTradeOpponent("human", "cpu", hand);
        return;
      }

      if (state.mode === "snipe") {
        if (owner !== "cpu") {
          setMessage("+1する相手の手を選んでください。");
          return;
        }
        if (state.cpu[hand] <= 0) {
          setMessage("相手の0の手は選べません。");
          return;
        }
        await applySnipe("human", "cpu", hand);
        return;
      }

      if (state.mode === "rapidFireDiscard") {
        setMessage("乱射で捨てる手札を1枚選んでください。");
        return;
      }

      if (state.mode === "rapidFireTarget") {
        if (owner !== "cpu") {
          setMessage("乱射する相手の手を選んでください。");
          return;
        }
        if (state.cpu[hand] <= 0) {
          setMessage("相手の0の手は選べません。");
          return;
        }
        await applyRapidFire("human", "cpu", state.pendingRapidFireDiscard, hand);
        state.pendingRapidFireDiscard = null;
        await endTurn();
        return;
      }

      if (state.mode === "cursedBullet") {
        if (owner !== "human") {
          setMessage("凶弾では自分の手を選んでください。");
          return;
        }
        if (state.human.L <= 0 || state.human.R <= 0) {
          setMessage("凶弾は自分の両手が1以上のときだけ使えます。");
          state.mode = "attack";
          render();
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("0の手では凶弾を使えません。");
          return;
        }
        await applyCursedBullet("human", hand);
        await endTurn();
        return;
      }

      if (state.mode === "moveOne") {
        if (owner !== "human") {
          setMessage("自分の手を選んでください。");
          return;
        }
        if (!applyMoveOne("human", hand)) {
          setMessage("その手からは移せません。もう片方の手を選んでください。");
        }
        return;
      }

      if (state.mode === "setTrap" || state.mode === "setupTrap" || state.mode === "setBlessing" || state.mode === "setCurse") {
        const targetOwner = state.mode === "setCurse" ? "cpu" : "human";
        const label = state.mode === "setCurse" ? "呪縛" : state.mode === "setBlessing" ? "加護" : "罠";
        if (owner !== targetOwner) {
          setMessage(`${label}は${targetOwner === "human" ? "自分" : "相手"}の手の下に設置します。設置する手を選んでください。`);
          return;
        }
        if (state.selectedTrapCardIndex === null) return;
        if (state[targetOwner][hand] <= 0) {
          setMessage(`0の手には${label}を設置できません。`);
          return;
        }
        if (state.traps[targetOwner][hand].length >= 2) {
          setMessage("その手にはすでに2枚置かれています。");
          return;
        }
        const selectedCardId = state.hands.human[state.selectedTrapCardIndex];
        if (CARD_LIBRARY[selectedCardId]?.blessing && hasSealCurse(targetOwner, hand)) {
          setMessage("封印の呪縛により、その手には新たに加護を置けません。");
          return;
        }
        await setTrap("human", hand, state.selectedTrapCardIndex, targetOwner);
        return;
      }

      if (state.mode !== "attack") return;

      if (owner === "human") {
        if (!isAlive("human", hand)) {
          setMessage("0の手では攻撃できません。");
          return;
        }

        state.selectedAttackHand = hand;
        setMessage(`${handNames[hand]}で攻撃します。攻撃する相手の手を選んでください。`);
        render();
        return;
      }

      if (owner === "cpu") {
        if (!state.selectedAttackHand) {
          setMessage("先に自分の攻撃する手を選んでください。");
          return;
        }

        if (!isAlive("cpu", hand)) {
          setMessage("0の手は攻撃対象にできません。");
          return;
        }

        await attack("human", state.selectedAttackHand, "cpu", hand);
        await resolveActionDone();
      }
    }

    function resetGame() {
      const humanDeck = buildDeckFromCounts("human");
      const cpuDeck = buildDeckFromCounts("cpu");

      state.human = { L: 1, R: 1 };
      state.cpu = { L: 1, R: 1 };
      state.traps.human = { L: [], R: [] };
      state.traps.cpu = { L: [], R: [] };
      state.decks.human = shuffle(humanDeck);
      state.decks.cpu = shuffle(cpuDeck);
      state.hands.human = [];
      state.hands.cpu = [];
      state.discard.human = [];
      state.discard.cpu = [];
      state.temp.human = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false };
      state.temp.cpu = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false };
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingRepairDiscard = null;
      state.revealedTrapIds = new Set();
      state.noSplit = { human: false, cpu: false };
      state.extraActions = { human: 0, cpu: 0 };
      state.pendingAcceleration = { human: 0, cpu: 0 };
      state.activeAcceleration = { human: 0, cpu: 0 };
      state.pendingNoDraw = { human: 0, cpu: 0 };
      state.activeNoDraw = { human: 0, cpu: 0 };
      state.pendingTerminalEnd = { human: false, cpu: false };
      state.costLimitNextTurn = { human: null, cpu: null };
      state.activeCostLimit = { human: null, cpu: null };
      state.berserkerTurns = { human: 0, cpu: 0 };
      state.pendingEqualTradeSelf = null;
      state.pendingRapidFireDiscard = null;
      state.pendingSwapFirst = null;
      state.firstTurnStarted = { human: false, cpu: false };
      state.weaknessWait = {};
      state.highlight = null;
      state.lastAction = null;
      state.turn = "human";
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.animating = false;
      state.gameOver = false;
      state.log = [];
      state.turnNumber = 1;
      elements.splitBox.classList.remove("active");
      clearHighlights();

      addLog("新しい対戦を開始しました。");
      for (let i = 0; i < 3; i++) {
        drawCard("human");
        drawCard("cpu");
      }
      startTurn("human");
      renderDeckBuilder();
    }

    document.querySelectorAll(".hand").forEach(card => {
      card.addEventListener("click", onHandClick);
    });

    elements.offlineModeBtn.addEventListener("click", () => showScreen("menu"));
    elements.onlineModeBtn.addEventListener("click", () => showScreen("onlineMenu"));
    elements.offlineBackModeBtn.addEventListener("click", () => showScreen("modeMenu"));
    elements.onlineBackModeBtn.addEventListener("click", () => showScreen("modeMenu"));
    elements.onlineStartBtn.addEventListener("click", () => {
      if (!state.onlineDeckCounts) state.onlineDeckCounts = loadOnlineDeckCounts();
      if (!onlineDeckIsValid(state.onlineDeckCounts)) {
        alert("PVPデッキが無効です。デッキ編集から条件を満たすデッキを作成してください。");
        return;
      }
      showScreen("friendLobby");
      updateFriendLobbyView();
    });
    elements.onlineDeckBtn.addEventListener("click", () => showScreen("onlineDeck"));
    elements.onlineDeckBackBtn.addEventListener("click", () => showScreen("onlineMenu"));
    elements.onlineDeckDefaultBtn.addEventListener("click", () => {
      state.onlineDeckCounts = defaultOnlineDeckCounts();
      saveOnlineDeckCounts();
      renderOnlineDeckEditor();
    });
    elements.onlineDeckExportBtn.addEventListener("click", () => {
      if (!state.onlineDeckCounts) state.onlineDeckCounts = loadOnlineDeckCounts();
      const code = encodeOnlineDeckCode(state.onlineDeckCounts);
      elements.onlineDeckCodeBox.value = code;
      elements.onlineDeckCodeMessage.textContent = "デッキコードを作成しました。";
    });
    elements.onlineDeckImportBtn.addEventListener("click", () => {
      try {
        const counts = decodeOnlineDeckCode(elements.onlineDeckCodeBox.value);
        state.onlineDeckCounts = counts;
        saveOnlineDeckCounts();
        renderOnlineDeckEditor();
        elements.onlineDeckCodeMessage.textContent = "デッキコードを読み込みました。";
      } catch (error) {
        elements.onlineDeckCodeMessage.textContent = `読み込み失敗：${error.message || error}`;
      }
    });
    elements.onlineDeckCopyBtn.addEventListener("click", async () => {
      try {
        if (!elements.onlineDeckCodeBox.value.trim()) {
          elements.onlineDeckCodeBox.value = encodeOnlineDeckCode(state.onlineDeckCounts || loadOnlineDeckCounts());
        }
        await navigator.clipboard.writeText(elements.onlineDeckCodeBox.value);
        elements.onlineDeckCodeMessage.textContent = "デッキコードをコピーしました。";
      } catch (_) {
        elements.onlineDeckCodeMessage.textContent = "コピーできない場合はコード欄を選択してコピーしてください。";
      }
    });
    elements.onlineDeckSaveSlotBtn.addEventListener("click", () => {
      localStorage.setItem(onlineDeckSlotKey(), JSON.stringify(state.onlineDeckCounts || loadOnlineDeckCounts()));
      elements.onlineDeckCodeMessage.textContent = `${elements.onlineDeckSlotSelect.value}番スロットに保存しました。`;
    });
    elements.onlineDeckLoadSlotBtn.addEventListener("click", () => {
      try {
        const raw = localStorage.getItem(onlineDeckSlotKey());
        if (!raw) {
          elements.onlineDeckCodeMessage.textContent = "このスロットにはまだ保存されていません。";
          return;
        }
        const parsed = JSON.parse(raw);
        const counts = {};
        Object.keys(parsed).forEach(id => {
          if (!FRIEND_SIMPLE_LIBRARY[id]) return;
          const n = Math.max(0, Math.min(ONLINE_DECK_MAX_SAME, Number(parsed[id]) || 0));
          if (n > 0) counts[id] = n;
        });
        if (!onlineDeckIsValid(counts)) throw new Error("保存デッキが条件を満たしていません。");
        state.onlineDeckCounts = counts;
        saveOnlineDeckCounts();
        renderOnlineDeckEditor();
        elements.onlineDeckCodeMessage.textContent = `${elements.onlineDeckSlotSelect.value}番スロットを読み込みました。`;
      } catch (error) {
        elements.onlineDeckCodeMessage.textContent = `スロット読込失敗：${error.message || error}`;
      }
    });
    elements.menuStartBtn.addEventListener("click", () => showScreen("battleSelect"));
    elements.plVsCpuBtn.addEventListener("click", () => showScreen("difficulty"));
    elements.plVsPlBtn.addEventListener("click", () => {
      showScreen("friendLobby");
      updateFriendLobbyView();
    });
    elements.battleSelectBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.friendLobbyBackBtn.addEventListener("click", () => showScreen("onlineMenu"));
    elements.createRoomBtn.addEventListener("click", () => createFriendRoom().catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `部屋作成エラー：${error.message || error}`;
    }));
    elements.joinRoomBtn.addEventListener("click", () => {
      joinFriendRoom(elements.roomIdInput.value).catch(error => {
        console.error(error);
        elements.friendLobbyMessage.textContent = `入室エラー：${error.message || error}`;
      });
    });
    elements.friendReadyBtn.addEventListener("click", () => setFriendReady(true).catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `準備完了エラー：${error.message || error}`;
    }));
    elements.friendUnreadyBtn.addEventListener("click", () => setFriendReady(false).catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `準備解除エラー：${error.message || error}`;
    }));
    elements.friendStartGameBtn.addEventListener("click", () => startFriendSimpleGame().catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `簡易試合開始エラー：${error.message || error}`;
    }));
    elements.friendAttackBtn.addEventListener("click", () => {
      if (!friendCanAct(state.friendRoomData?.game)) return;
      friendCloseActionEditors();
      friendSetPendingTapAction({ type: "attackFrom" });
    });
    elements.friendSplitBtn.addEventListener("click", () => {
      if (!friendCanAct(state.friendRoomData?.game)) return;
      state.friendPendingTapAction = null;
      friendPrepareSplitEditor(state.friendRoomData?.game);
      elements.friendSplitBox?.classList.toggle("active");
      updateFriendGameView(state.friendRoomData?.game);
    });
    elements.friendConfirmSplitBtn?.addEventListener("click", () => friendSplitAction().then(() => {
      friendCloseActionEditors();
    }).catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `分ける同期エラー：${error.message || error}`;
    }));
    elements.friendCancelBtn?.addEventListener("click", () => {
      friendCloseActionEditors(true);
      updateFriendGameView(state.friendRoomData?.game);
    });
    [elements.friendHostLeft, elements.friendHostRight, elements.friendGuestLeft, elements.friendGuestRight].forEach(btn => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        const clickedRole = btn.dataset.role;
        const clickedHand = btn.dataset.hand;
        if (!state.friendRole) return;
        // Legacy hidden hand buttons do not change selection while idle.
        const side = clickedRole === state.friendRole ? "own" : "opponent";
        friendHandleTapAction(side, clickedHand);
      });
    });

    [elements.friendOwnLeft, elements.friendOwnRight, elements.friendOpponentLeft, elements.friendOpponentRight].forEach(btn => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        const clickedSide = btn.dataset.side;
        const clickedHand = btn.dataset.hand;
        if (!state.friendRole) return;
        if (friendHandleTapAction(clickedSide, clickedHand)) return;
        // 通常時の手タップは何もしない。対象選択が必要な行動中だけ反応する。
      });
    });
    elements.friendAttackFrom.addEventListener("change", () => {
      state.friendSelectedOwnHand = elements.friendAttackFrom.value;
      updateFriendGameView(state.friendRoomData?.game);
    });
    elements.friendAttackTo.addEventListener("change", () => {
      state.friendSelectedTargetHand = elements.friendAttackTo.value;
      updateFriendGameView(state.friendRoomData?.game);
    });
    elements.friendBattleBackLobbyBtn.addEventListener("click", () => showScreen("friendLobby"));
    elements.friendRestartSimpleBtn.addEventListener("click", () => startFriendSimpleGame().catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `再開始エラー：${error.message || error}`;
    }));
    elements.copyRoomUrlBtn.addEventListener("click", async () => {
      if (!state.friendRoomUrl) return;
      try {
        await navigator.clipboard.writeText(state.friendRoomUrl);
        elements.friendLobbyMessage.textContent = "部屋URLをコピーしました。友達に送ってください。";
      } catch (_) {
        elements.friendLobbyMessage.textContent = "コピーできない場合は、表示されたURLを長押し/選択してコピーしてください。";
      }
    });
    elements.menuDeckBtn.addEventListener("click", () => showScreen("deck"));
    elements.menuSettingsBtn.addEventListener("click", () => showScreen("settings"));
    elements.difficultyBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.settingsBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.deckBackMenuBtn.addEventListener("click", () => showScreen("menu"));
    elements.battleBackMenuBtn.addEventListener("click", () => showScreen("menu"));
    elements.battleRestartBtn.addEventListener("click", () => startBattleWithDifficulty(state.cpuDifficulty));

    document.querySelectorAll("[data-difficulty-start]").forEach(btn => {
      btn.addEventListener("click", () => startBattleWithDifficulty(btn.dataset.difficultyStart));
    });

    elements.attackBtn.addEventListener("click", () => {
      if (state.temp.human.setupMode) return;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      elements.splitBox.classList.remove("active");
      setMessage("自分の攻撃する手を選んでください。");
      render();
    });

    elements.splitBtn.addEventListener("click", () => {
      if (state.temp.human.setupMode) return;
      if (state.berserkerTurns.human > 0) {
        setMessage("バーサーカー中は分けるを選べません。");
        return;
      }
      if (state.noSplit.human) {
        setMessage("固定の効果で、このターンは分けるを選べません。");
        return;
      }
      if (!canHumanSplit()) {
        setMessage("今は分けられる形がありません。通常の分けるでは0の手を作れません。");
        return;
      }

      state.mode = "split";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      elements.splitBox.classList.add("active");
      setMessage("左右の本数を選んで、分け直してください。");
      render();
    });

    elements.drawBtn.addEventListener("click", () => {
      if (state.turn !== "human" || state.gameOver || state.animating || state.temp.human.setupMode) return;
      drawCard("human");
      setMessage("手札を1枚引きました。これはテスト用ボタンです。");
      render();
    });

    elements.cancelBtn.addEventListener("click", async () => {
      if (state.turn === "human" && state.temp.human.setupMode && !state.gameOver) {
        state.temp.human.setupMode = false;
        state.mode = "attack";
        state.selectedAttackHand = null;
        state.selectedTrapCardIndex = null;
        state.pendingTrapTargetEffect = null;
        state.pendingRepairDiscard = null;
        state.pendingEqualTradeSelf = null;
        state.pendingRapidFireDiscard = null;
        state.pendingSwapFirst = null;
        elements.splitBox.classList.remove("active");
        setMessage("仕込みを終了しました。相手にターンを渡します。");
        render();
        await endTurn();
        return;
      }
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      elements.splitBox.classList.remove("active");
      setMessage("選択を解除しました。");
      render();
    });

    elements.resetBtn.addEventListener("click", () => {
      resetGame();
      setMessage("試合をリセットしました。");
    });

    elements.splitLeft.addEventListener("change", () => syncSplitSelects("left"));
    elements.splitRight.addEventListener("change", () => syncSplitSelects("right"));

    elements.confirmSplitBtn.addEventListener("click", async () => {
      const value = elements.splitLeft.value;
      if (!value || state.animating) return;

      const [left, right] = value.split(",").map(Number);
      await split("human", left, right, true);
      await resolveActionDone();
    });

    elements.toggleDeckBtn.addEventListener("click", () => {
      elements.deckPanel.classList.toggle("show");
      const isOpen = elements.deckPanel.classList.contains("show");
      elements.deckBottomBar.classList.toggle("hidden", !isOpen);
      elements.toggleDeckBtn.textContent = isOpen
        ? "編集を閉じる"
        : "編集を開く";
      renderDeckBuilder();
    });

    elements.costLimitInput.addEventListener("input", () => {
      const value = Number(elements.costLimitInput.value);
      state.costLimit = Math.min(40, Number.isFinite(value) && value > 0 ? Math.floor(value) : 1);
      elements.costLimitInput.value = state.costLimit;
      renderDeckBuilder();
    });

    elements.applyDeckBtn.addEventListener("click", () => {
      if (!areBothDecksValid()) {
        const h = getDeckStats("human");
        const c = getDeckStats("cpu");
        if (h.count < DECK_MIN_COUNT || c.count < DECK_MIN_COUNT) setMessage(`あなた用・CPU用の両方を最低${DECK_MIN_COUNT}枚以上にしてください。`);
        else if (h.count > DECK_MAX_COUNT || c.count > DECK_MAX_COUNT) setMessage(`あなた用・CPU用の両方を${DECK_MAX_COUNT}枚以内にしてください。`);
        else setMessage("あなた用・CPU用のどちらかがコスト上限を超えています。");
        return;
      }
      setMessage("デッキは使用可能です。対戦を始める場合は、メニューに戻ってスタートを選んでください。");
      renderDeckBuilder();
    });

    elements.defaultDeckBtn.addEventListener("click", () => {
      state.deckCounts[state.editingDeckOwner] = { ...DEFAULT_DECK_COUNTS };
      renderDeckBuilder();
      setMessage(`${state.editingDeckOwner === "human" ? "あなた用" : "CPU用"}デッキを初期状態に戻しました。反映するにはリスタートしてください。`);
    });


    elements.deckOwnerSelect.addEventListener("change", () => {
      state.editingDeckOwner = elements.deckOwnerSelect.value;
      renderDeckBuilder();
      setMessage(`${state.editingDeckOwner === "human" ? "あなた用" : "CPU用"}デッキを編集中です。`);
    });

    elements.cpuDifficultySelect.addEventListener("change", () => {
      state.cpuDifficulty = elements.cpuDifficultySelect.value;
      renderDeckBuilder();
      const labels = { easy: "やさしめ", standard: "標準", hard: "強め" };
      setMessage(`CPU難易度を「${labels[state.cpuDifficulty]}」にしました。`);
    });

    elements.saveDeckBtn.addEventListener("click", saveDecks);
    elements.loadDeckBtn.addEventListener("click", loadDecks);
    elements.copyDeckBtn.addEventListener("click", () => {
      const from = state.editingDeckOwner;
      const to = from === "human" ? "cpu" : "human";
      state.deckCounts[to] = { ...currentDeckCounts(from) };
      renderDeckBuilder();
      setMessage(`${from === "human" ? "あなた用" : "CPU用"}デッキを${to === "human" ? "あなた用" : "CPU用"}にコピーしました。`);
    });

    elements.exportCurrentDeckBtn.addEventListener("click", exportCurrentDeckCode);
    elements.exportBothDecksBtn.addEventListener("click", exportBothDecksCode);
    elements.copyDeckCodeBtn.addEventListener("click", copyDeckCode);
    elements.importDeckCodeBtn.addEventListener("click", importDeckCode);

    elements.openHelpBtn.addEventListener("click", () => openHelp("basic"));
    elements.openCardsHelpBtn.addEventListener("click", () => openHelp("cards"));
    elements.helpCloseBtn.addEventListener("click", closeHelp);
    elements.helpModal.addEventListener("click", (event) => {
      if (event.target === elements.helpModal) closeHelp();
    });
    elements.helpTabs.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => renderHelp(btn.dataset.helpTab));
    });

    state.onlineDeckCounts = loadOnlineDeckCounts();
    renderDeckBuilder();
    renderOnlineDeckEditor();
    showScreen("modeMenu");
    loadRoomFromUrl();
