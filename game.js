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
        cost: 1,
        type: "補助",
        text: "このターン、次の通常攻撃で攻撃する手の本数を+1して扱う。",
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
        text: "このターン、次の通常攻撃で加える本数-1。ただし1未満にならない。",
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
        type: "補助",
        text: "手札を1枚捨て、自分の0の手を1にする。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] === 0) && countHandCards(player) > 1,
        effect: async (player) => {
          const zeroHands = ["L", "R"].filter(h => state[player][h] === 0);
          if (zeroHands.length === 0) return;

          if (player === "human") {
            state.mode = "repairDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
            setMessage("「補修」：捨てる手札を1枚選んでください。補修後も攻撃か分けるができます。");
            return;
          }

          const hand = zeroHands[0];
          const discardIndex = chooseCpuDiscardIndex();
          if (discardIndex < 0) return;
          const discarded = await discardHandCardByEffect(player, discardIndex);
          state[player][hand] = 1;
          addLog(`${handNames[player]}は「補修」で「${CARD_LIBRARY[discarded].name}」を捨て、${handNames[hand]}を0→1に戻した。`);
        }
      },

      charge: {
        name: "充電", cost: 1, type: "使用不可 / 生成カード / 充電",
        text: "Lv.1～10。コストはレベルと同じ。充電効果以外では捨てたり移動できない。充電を得る時はレベルが上がり、Lv.10ではそれ以上得られない。",
        token: true, chargeResource: true, countsAsHandCard:false, discardable:false, canPlay: () => false
      },
      overcharge: {
        name: "過充電", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電をLv.10にする。次の自分のターンは行動不能になる。",
        canPlay: () => true,
        effect: (player) => {
          setChargeLevel(player, 10);
          state.pendingChargeStun[player] = true;
          state.pendingChargeStunSource[player] = "過充電";
          addLog(`${handNames[player]}は「過充電」で充電をLv.10にした。反動は次の自分ターンに発生する。`);
        }
      },
      electricConnection: {
        name: "電気接続", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電を3得て、カードを1枚引く。", canPlay: () => true,
        effect: (player) => { gainCharge(player,3,"電気接続"); drawCard(player); }
      },
      electrolyte: {
        name: "電解質", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "自分の手の合計値だけ充電を得る。", canPlay: () => true,
        effect: (player) => gainCharge(player,(state[player].L||0)+(state[player].R||0),"電解質")
      },
      lightningStrike: {
        name: "雷撃", cost: 1, type: "補助 / 充電", chargeCard: true,
        text: "充電5を消費。使用前の充電4につき、次の通常攻撃で加える本数+1。使用前がLv.10なら、その通常攻撃で超過計算前の合計が5以上になった時、あまりを計算せず0にする。充電不足なら不発。",
        canPlay: () => true,
        effect: (player) => {
          const before = getChargeLevel(player);
          if (!consumeCharge(player, 5, false, "雷撃")) return;
          const bonus = Math.floor(before / 4);
          state.temp[player].lightningBonus =
            (state.temp[player].lightningBonus || 0) + bonus;
          state.temp[player].lightningZeroAtFive = before >= 10;
          state.temp[player].lightningNoChargeGain = true;
          addLog(
            `${handNames[player]}の「雷撃」：使用前の充電Lv.${before}により、次の攻撃+${bonus}` +
            `${before >= 10 ? "、超過計算前に5以上なら0" : ""}。この攻撃ではダメージ由来の充電を獲得できない。`
          );
        }
      },
      kineticConversion: {
        name: "運動エネルギー変換", cost: 2, type: "罠 / 充電", trap: true, manual: false, chargeCard: true,
        text: "【自動】この手に加えられる本数-1。軽減前の本数だけ充電を得る。あらゆる本数追加に作用する。",
        triggerTiming: "after", canTrigger: () => false
      },
      leap: {
        name: "跳躍", cost: 1, type: "補助 / 充電", chargeCard: true,
        text: "充電3を消費し、カードを2枚引く。充電不足なら不発。", canPlay: () => true,
        effect: (player) => { if(!consumeCharge(player,3,false,"跳躍")) return; drawCard(player); drawCard(player); }
      },
      dischargeBlessing: {
        name: "放電の加護", cost: 2, type: "加護 / 充電", blessing: true, chargeCard: true,
        text: "自分の充電5につきこの手が受ける本数-1。充電Lv.10なら、この手の通常攻撃で加える本数+1。",
        canPlay: (player) => canPlaceAttachment(player,player)
      },
      synapseMotion: {
        name: "シナプス運動", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "次の通常攻撃で加える本数+1。充電を4得る。", canPlay: () => true,
        effect: (player) => { state.temp[player].synapseBonus=(state.temp[player].synapseBonus||0)+1; gainCharge(player,4,"シナプス運動"); }
      },
      lightSpeedCircuit: {
        name: "光速回路", cost: 3, type: "補助 / 充電", chargeCard: true,
        text: "この効果は1試合に1度しか発動できない。すでに発動済みなら不発。使用時の充電がLv.10未満なら不発。Lv.10なら、このターン充電カードを何枚でも使用でき、充電カードの終端を無視する。ターン終了時に充電を0にし、次の自分のターンは行動不能になる。",
        canPlay: (player) => !state.lightSpeedCircuitUsed[player],
        effect: async (player) => {
          const charge = getChargeLevel(player);

          if (state.lightSpeedCircuitUsed[player]) {
            addLog(`${handNames[player]}の「光速回路」は一試合に一度しか発動できず、不発。`);
            return;
          }

          if (charge !== 10) {
            addLog(
              `${handNames[player]}の「光速回路」は充電不足（必要10 / 現在${charge}）で不発。`
            );
            return;
          }

          state.lightSpeedCircuitUsed[player] = true;
          state.temp[player].lightSpeedCircuit = true;
          state.pendingChargeStun[player] = true;
          state.pendingChargeStunSource[player] = "光速回路";
          addLog(
            `${handNames[player]}は「光速回路」を起動。` +
            `このターンは充電カードを何枚でも使用でき、反動は次の自分ターンに発生する。`
          );

          if (state.battleMode === "friend" && player === "human" && !state.friendApplyingRemoteState) {
            emitFriendFx("lightSpeedCircuit", {
              playerSide: friendSideForLocalPlayer(player)
            }).catch(error => console.error("PVP light speed circuit fx failed", error));
          }

          await showLightSpeedCircuitFx(player);
        }
      },
      electric: {
        name: "エレクトリック", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "現在の充電Lv.を3で割った値（小数点以下切り捨て）だけ、選択した相手の手に本数を加える。その後、充電Lv.を半分（小数点以下切り捨て）にしてターンを終了する。",
        canPlay: () => true,
        effect: (player) => beginChargeTargetEffect(player, "electric")
      },
      bioticE: {
        name: "バイオティックE", cost: 2, type: "加護 / 充電", blessing: true, chargeCard: true,
        text: "この手の通常攻撃によって攻撃対象の手を0にした時、その攻撃で与えた本数の2倍だけ充電を得る。",
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      electromagneticWave: {
        name: "電磁波", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電4を消費する。選択した相手の手の本数を半分（小数点以下切り捨て）にする。充電不足なら不発。",
        canPlay: () => true,
        effect: (player) => {
          if (!consumeCharge(player, 4, false, "電磁波")) return;
          beginChargeTargetEffect(player, "electromagneticWave");
        }
      },
      cheapBattery: {
        name: "廉価バッテリー", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電9を得る。次の自分のターン開始時から2ターンの間、充電が2減る。",
        canPlay: () => true,
        effect: (player) => {
          gainCharge(player, 9, "廉価バッテリー");
          state.cheapBatteryDecay[player] = 2;
          addLog(`${handNames[player]}の「廉価バッテリー」：次の自分ターンから2回、ターン開始時に充電2減少。`);
        }
      },
      energyBarrier: {
        name: "エネルギーバリア", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電5を消費する。次の自分のターン開始時まで、受ける本数を2減らす。充電不足なら不発。",
        canPlay: () => true,
        effect: (player) => {
          if (!consumeCharge(player, 5, false, "エネルギーバリア")) return;
          state.energyBarrier[player] = 2;
          addLog(`${handNames[player]}は「エネルギーバリア」を展開。次の自分ターン開始時まで受ける本数-2。`);
        }
      },
      laserBeam: {
        name: "レーザービーム", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "現在の充電をすべて消費し、消費した値だけ選択した相手の手に本数を加える。通常の超過計算を行い、ターンを終了する。",
        canPlay: () => true,
        effect: (player) => beginChargeTargetEffect(player, "laserBeam")
      },
      electromagneticInduction: {
        name: "電磁誘導", cost: 1, type: "補助 / 充電", chargeCard: true,
        text: "自分の手を1つ選び、その手を現在の充電Lv.と同じ値にして通常の超過計算を行う。充電は消費しない。",
        canPlay: () => true,
        effect: (player) => beginChargeTargetEffect(player, "electromagneticInduction")
      },
      electromagneticAttack: {
        name: "電磁攻撃", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "充電5を消費する。このターン、自分の通常攻撃は相手の罠カードを発動させない。罠は破壊せず残る。",
        canPlay: () => true,
        effect: (player) => {
          if (!consumeCharge(player, 5, false, "電磁攻撃")) return;
          state.temp[player].electromagneticAttack = true;
          addLog(`${handNames[player]}は「電磁攻撃」を使用。このターンの通常攻撃は相手の罠を発動させない。`);
        }
      },
      mechanicalGeneration: {
        name: "力学発電", cost: 2, type: "加護 / 充電", blessing: true, chargeCard: true,
        text: "この手で通常攻撃した時、その攻撃で与えた本数と同じ値だけ充電を得る。",
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      chemicalGeneration: {
        name: "化学発電", cost: 2, type: "加護 / 充電", blessing: true, chargeCard: true,
        text: "自分が手札からカードを使用するたび、充電1を得る。乱闘・予告状による効果だけの発動は含まない。",
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      solarGeneration: {
        name: "太陽光発電", cost: 2, type: "加護 / 充電", blessing: true, chargeCard: true,
        text: "自分のターン開始時、充電2を得る。",
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      emc2: {
        name: "E=mc²", cost: 2, type: "手札誘発 / 充電", chargeCard: true,
        text: "自分が敗北する本数追加・カード効果を受けた時、充電6以上なら手札から発動する。充電をすべて消費し、最後の手を4にする。ロジックアトリエは充電10でのみ防げる。",
        canPlay: () => false
      },

      dimensionalSlash: {
        name: "空間切断", cost: 3, type: "補助 / 充電", chargeCard: true,
        text: "この効果は1ターンに1度しか発動できない。すでにこのターン発動している場合は不発。充電5未満なら不発。充電5以上10未満なら充電5を消費し、自分の手を1つ0にして発動。充電10なら充電5を消費し、手を失わず発動。このターンの通常攻撃で加える本数+1。通常攻撃を2回行える。1回目の後は攻撃だけを選べる。",
        canPlay: (player) => !state.temp[player].dimensionalSlashUsed,
        effect: async (player) => {
          if (state.temp[player].dimensionalSlashUsed) {
            addLog(`${handNames[player]}の「空間切断」はこのターン既に使用されているため不発。`);
            return;
          }

          state.temp[player].dimensionalSlashUsed = true;
          const charge = getChargeLevel(player);

          if (charge < 5) {
            addLog(`${handNames[player]}の「空間切断」は充電不足（必要5 / 現在${charge}）で不発。`);
            return;
          }

          if (charge < 10) {
            if (player === "human") {
              state.animating = false;
              state.mode = "dimensionalSlashSacrifice";
              state.selectedAttackHand = null;
              setMessage("「空間切断」：代償として0にする、自分の0ではない手を選んでください。");
              render();
              return;
            }
            const choices = ["L", "R"].filter(hand => state[player][hand] > 0);
            const chosen = choices.sort((a, b) => state[player][a] - state[player][b])[0] || "L";
            await resolveDimensionalSlash(player, chosen);
            return;
          }

          await resolveDimensionalSlash(player, null);
        }
      },

      brawl: {
        name: "乱闘",
        cost: 2,
        type: "補助",
        text: "自分の手札から「乱闘」「指令」「ロジックアトリエ」を除く、効果を持つカードをランダムに1枚選ぶ。そのカードを通常使用するための条件とコストを無視し、効果だけを発動する。効果本文にある発動条件・不発条件・対象・消費・代償は無視しない。選ばれたカードは消費されない。",
        canPlay: (player) => getBrawlCandidates(player).length > 0,
        effect: async (player) => {
          const candidates = getBrawlCandidates(player);
          if (!candidates.length) {
            addLog(`${handNames[player]}の「乱闘」は、発動できるカードがなく不発になった。`);
            return;
          }
          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          const copied = CARD_LIBRARY[picked.cardId];
          addLog(`${handNames[player]}の「乱闘」により「${copied.name}」の効果が無償で発動する。元のカードは手札に残る。`);
          await showCardPopup(player, copied, false, player === "cpu" ? 760 : 620);
          await activateCopiedCardEffect(player, picked.cardId, "乱闘", { sourceHandIndex: picked.index });
        }
      },
      advanceNotice: {
        name: "予告状",
        cost: 2,
        type: "補助",
        text: "現在通常使用できるカードを手札から1枚選び、相手に公開して捨て札にする。次の自分のターン開始時、そのカードを通常使用するための条件とコストを無視し、効果だけを発動する。効果本文にある発動条件・不発条件・対象・消費・代償は、その時点の状態で判定する。「題目設定」「予告状」「指令」「ロジックアトリエ」は選べない。",
        canPlay: (player) => getAdvanceNoticeCandidates(player).length > 0,
        effect: async (player) => {
          const candidates = getAdvanceNoticeCandidates(player);
          if (!candidates.length) {
            addLog(`${handNames[player]}の「予告状」は、宣言できるカードがなく不発になった。`);
            return;
          }
          if (player === "human") {
            state.mode = "advanceNoticeChoose";
            setMessage("「予告状」：次の自分のターンに発動するカードを選んでください。選んだカードは公開して捨て札になります。");
            return;
          }
          candidates.sort((a, b) => (CARD_LIBRARY[b.cardId]?.cost || 0) - (CARD_LIBRARY[a.cardId]?.cost || 0));
          await chooseAdvanceNoticeCard(player, candidates[0].index);
        }
      },
      duelSurge: {
        name: "決闘高潮",
        cost: 3,
        type: "加護",
        text: "この加護が付いた手で同じ手を連続して通常攻撃するとLvが上がる。別の手を攻撃するとLv1になる。最大Lv5。Lvに応じて通常攻撃で加える本数の増加・受ける本数の軽減を得る。別の自分の手による攻撃では変化しない。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
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
        cost: 2,
        type: "補助",
        text: "次の自分のターンから3ターンの間、ターン開始時に追加で1枚引く。その後2ターンの間、ターン開始時にカードを引けない。",
        canPlay: () => true,
        effect: (player) => {
          state.pendingAcceleration[player] += 3;
          state.pendingNoDraw[player] += 2;
          addLog(`${handNames[player]}は「過加速」を使った。次の自分のターンから3ターン追加で1枚引き、その後2ターンはドローできない。`);
        }
      },

      randomDice: {
        name: "ランダムダイス",
        cost: 1,
        type: "補助",
        text: "自分の0でない手を1つ選ぶ。その手の本数を0〜4のランダムな本数に変更する。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] > 0),
        effect: async (player) => {
          const choices = ["L", "R"].filter(h => state[player][h] > 0);
          if (!choices.length) { addLog(`${handNames[player]}の「ランダムダイス」は対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "randomDice";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
            setMessage("「ランダムダイス」：本数を変える自分の0でない手を選んでください。");
            return;
          }
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
        effect: async (player) => {
          const opponent = otherPlayer(player);
          if (!["L", "R"].some(h => state[player][h] > 0) || !["L", "R"].some(h => state[opponent][h] >= 2)) {
            addLog(`${handNames[player]}の「等価交換」は対象が存在しないため不発。`);
            return;
          }
          if (player === "human") {
            state.mode = "equalTradeSelf";
            state.pendingEqualTradeSelf = null;
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
          if (!["L", "R"].some(h => state[otherPlayer(player)][h] > 0)) {
            addLog(`${handNames[player]}の「狙撃」は対象が存在しないため不発。`);
            return;
          }
          if (player === "human") {
            state.mode = "snipe";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
        type: "終端 / 銃",
        text: "終端。このカードは「銃」として扱う。手札を1枚捨て、捨てた手札のコスト分のダメージを相手の手に与える。捨てたカードが「弾」ならダメージ+1。この攻撃には一部の罠を発動できる。",
        gun: true,
        canPlay: (player) => countHandCards(player) > 1 && ["L", "R"].some(h => state[player === "human" ? "cpu" : "human"][h] > 0),
        terminal: true,
        effect: async (player) => {
          const opponent = otherPlayer(player);
          state.pendingRapidFireExcludedIndex =
            state.copiedEffectContext?.sourceLabel === "乱闘" && state.copiedEffectContext?.cardId === "rapidFire"
              ? Number(state.copiedEffectContext.sourceHandIndex)
              : null;
          const hasDiscard = getRapidFireDiscardCandidates(player).length > 0;
          const hasTarget = ["L", "R"].some(h => state[opponent][h] > 0);
          if (!hasDiscard || !hasTarget) {
            addLog(`${handNames[player]}の「乱射」は${!hasDiscard ? "捨てられる手札" : "攻撃対象"}が存在しないため不発。`);
            state.pendingRapidFireExcludedIndex = null;
            return;
          }
          if (player === "human") {
            state.mode = "rapidFireDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
            setMessage("「乱射」：弾薬として捨てる手札を1枚選んでください。");
            return;
          }
          const discardIndex = chooseCpuRapidFireDiscardIndex(player);
          if (discardIndex < 0) {
            state.pendingTerminalEnd[player] = true;
            return;
          }
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
        type: "補助 / 弾",
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
        type: "補助 / 弾",
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
        type: "補助 / 弾",
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
        text: "自分の捨て札にある「銃」カードをランダムに1枚手札に加える。捨て札に「銃」がない場合、何も起こらない。",
        canPlay: () => true,
        effect: (player) => {
          const indexes = [];
          state.discard[player].forEach((cardId, index) => {
            if (CARD_LIBRARY[cardId]?.gun) indexes.push(index);
          });
          if (indexes.length === 0) {
            addLog(`${handNames[player]}は「再装填」を使ったが、捨て札に銃カードがなかった。`);
            return;
          }
          const picked = indexes[Math.floor(Math.random() * indexes.length)];
          const [cardId] = state.discard[player].splice(picked, 1);
          state.hands[player].push(cardId);
          addLog(`${handNames[player]}は「再装填」で「${CARD_LIBRARY[cardId].name}」を手札に加えた。`);
        }
      },
      indiscriminateFire: {
        name: "無差別射撃", cost: 2, type: "終端 / 銃", gun: true, terminal: true,
        text: "終端。このカードは「銃」として扱う。手札を1枚捨て、そのカードのコストを威力とする。捨てたカードが「弾」なら威力+1。威力の回数だけ、自分と相手の0ではない手からランダムに1つ選び、その手に1本加える。対象は1回ごとに選び直す。この効果では罠は発動しない。",
        canPlay: player => countHandCards(player) > 1,
        effect: player => beginGunAmmoEffect(player, "indiscriminateFire")
      },
      shotgun: {
        name: "ショットガン", cost: 2, type: "終端 / 銃", gun: true, terminal: true,
        text: "終端。このカードは「銃」として扱う。手札を1枚捨て、そのカードのコストを威力とする。捨てたカードが「弾」なら威力+1。相手の0ではない両手に、それぞれ威力の半分（小数点以下切り捨て）の本数を加える。この効果では罠は発動しない。",
        canPlay: player => countHandCards(player) > 1,
        effect: player => beginGunAmmoEffect(player, "shotgun")
      },
      modulation: {
        name: "変調", cost: 1, type: "補助",
        text: "手札の「銃」カードを1枚選ぶ。そのカードを、選んだカードとは異なる任意のデッキに入れられる「銃」カードに変化させる。",
        canPlay: player => getModulationSourceCandidates(player).length > 0,
        effect: player => beginModulation(player)
      },
      fanning: {
        name: "ファニング", cost: 3, type: "終端 / 銃", gun: true, terminal: true,
        text: "終端。このカードは「銃」として扱う。自分の手札にある「弾」カードをすべて捨てる。相手の0ではない手を1つ選び、捨てた「弾」の枚数と6のうち少ない方の回数、その手に1本ずつ加える。途中で対象の手が0になった場合、相手のもう片方の手が0でなければ、残りの回数はその手に1本ずつ加える。",
        canPlay: () => true,
        effect: player => beginFanning(player)
      },
      recoveryBullet: {
        name: "回収弾", cost: 1, type: "補助 / 弾", bullet: true,
        text: "弾。効果で捨てられた時、自分の捨て札にある別の「弾」カードをランダムに1枚選び、山札に戻してシャッフルする。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "recoveryBullet")
      },
      reducedLoadBullet: {
        name: "減装弾", cost: 2, type: "補助 / 弾", bullet: true,
        text: "弾。効果で捨てられた時、自分の2本以上ある手のうち、最も本数の多い手を1本減らす。対象が複数ある場合はランダムに選ぶ。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "reducedLoadBullet")
      },
      tracerBullet: {
        name: "曳光弾", cost: 2, type: "補助 / 弾", bullet: true,
        text: "弾。このカードがカードの効果で手札から捨てられた時、自分の山札の上から3枚を確認し、その中に「弾」があればランダムに1枚を山札の一番上に置く。なければそのままにする。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "tracerBullet")
      },
      dudBullet: {
        name: "不発弾", cost: 0, type: "補助 / 弾", bullet: true,
        text: "弾。このカードがカードの効果で手札から捨てられた時、このカードを捨て札から山札に戻してシャッフルする。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "dudBullet")
      },
      disruptionBullet: {
        name: "阻害弾", cost: 1, type: "補助 / 弾", bullet: true,
        text: "弾。このカードがカードの効果で手札から捨てられた時、次の相手のターン開始時、相手はターン開始時の通常ドローを行わない。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "disruptionBullet")
      },
      shatterBullet: {
        name: "粉砕弾", cost: 1, type: "補助 / 弾", bullet: true,
        text: "弾。このカードがカードの効果で手札から捨てられた時、自分と相手の手札をそれぞれランダムに最大2枚捨てる。",
        canPlay: () => true, effect: player => logBulletNormalUse(player, "shatterBullet")
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
        text: "自分か相手の山札を選び、その山札の一番上のカードを確認する。",
        canPlay: () => true,
        effect: async (player) => {
          const opponent = player === "human" ? "cpu" : "human";
          let target = opponent;

          if (player === "human") {
            const inspectOwn = await showGameConfirmationText(
              "「探り」\n\n自分の山札を確認しますか？\n\nOK：自分の山札\nキャンセル：相手の山札"
            );
            target = inspectOwn ? player : opponent;
          } else {
            target = opponent;
          }

          const topCardId = state.decks[target][0];
          if (!topCardId) {
            await showPopup(
              player,
              "探り",
              `<div class="scout-popup-owner">${handNames[target]}の山札</div>` +
              `<div class="scout-popup-empty">山札にカードがありません。</div>`,
              "scout",
              1000,
              true
            );
            addLog(`${handNames[player]}は「探り」を使ったが、${handNames[target]}の山札は空だった。`);
            return;
          }

          const topCard = CARD_LIBRARY[topCardId];
          await showPopup(
            player,
            "山札の一番上",
            `<div class="scout-popup-owner">${handNames[target]}の山札</div>` +
            `<div class="scout-popup-card-name">「${escapeHtml(topCard.name)}」</div>` +
            `<div class="scout-popup-card-meta">コスト${topCard.cost} / ${escapeHtml(topCard.type)}</div>` +
            `<div class="scout-popup-card-text">${escapeHtml(topCard.text)}</div>`,
            "scout",
            1500,
            true
          );
          addLog(`${handNames[player]}は「探り」で${handNames[target]}の山札の一番上を確認した。`);
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
          if (!hasOpponentTrap(player)) { addLog(`${handNames[player]}の「解除」は対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "remove";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
          if (!hasOpponentTrap(player)) { addLog(`${handNames[player]}の「看破」は対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "reveal";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
          if (!hasMovableOpponentTrap(player)) { addLog(`${handNames[player]}の「手繰り寄せ」は対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "chooseOpponentTrap";
            state.pendingTrapTargetEffect = "move";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
          if (!hasSwapTargets(player)) { addLog(`${handNames[player]}の「すりかえ」は交換対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "swapOpponentAttachment";
            state.pendingSwapFirst = null;
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
        text: "このターン、自分の通常攻撃は相手側の罠・加護・呪縛の効果を受けない。",
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
          if (!canSetAnyTrap(player) || !state.hands[player].some(id => CARD_LIBRARY[id]?.trap)) {
            addLog(`${handNames[player]}の「仕込み」は設置できる罠が存在しないため不発。`);
            return;
          }
          state.temp[player].setupMode = true;
          state.mode = "setupTrap";
          state.selectedAttackHand = null;
          state.selectedTrapCardIndex = null;
          state.pendingTrapTargetEffect = null;
          elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
          addLog(`${handNames[player]}は「仕込み」を使った。罠を好きなだけ伏せられる。`);
          if (player === "human") {
            setMessage("「仕込み」：このターンは罠カードを好きなだけ伏せられます。終わったら「仕込み終了」を押してください。");
          }
        }
      },


      directiveAttack: {
        name: "指令：指定攻撃",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。引いた時に右手か左手を指定する。ターン終了時、指定された手で通常攻撃していれば達成：その手の次の通常攻撃で加える本数+1。未達成：その手の次の通常攻撃で加える本数-1。",
        directive: true,
        canPlay: () => false
      },
      directiveTarget: {
        name: "指令：対象指定",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。引いた時に攻撃する手と攻撃対象の手を指定する。ターン終了時、指定された組み合わせで通常攻撃していれば達成：カードを1枚引く。未達成：指定された自分の攻撃元の手に1本加える。",
        directive: true,
        canPlay: () => false
      },
      directiveSilence: {
        name: "指令：沈黙",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。ターン終了時、このターンに手札からカードを使用していなければ達成：カードを3枚引く。未達成：次の自分のターン、カードを使用できない。",
        directive: true,
        canPlay: () => false
      },
      directiveReform: {
        name: "指令：再編成",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。ターン終了時、このターンに「分ける」を行っていれば達成：次の自分のターン、最初の「分ける」の後も行動を続けられる。未達成：次の自分のターン、「分ける」を行えない。",
        directive: true,
        canPlay: () => false
      },
      directiveAnnihilation: { name:"指令：殲滅",cost:1,type:"指令 / 使用不可",text:"このカードは使用できない。このターン中に、自分の攻撃またはカード効果によって相手の手を1つ以上0にしていれば達成。達成：次の自分ターン中、自分の効果で相手の手が7以上になった時0にする。未達成：次の自分の通常攻撃で加える本数-1。",directive:true,canPlay:()=>false },
      directiveCombo: { name:"指令：連撃",cost:1,type:"指令 / 使用不可",text:"このカードは使用できない。このターン中に通常攻撃を2回以上行っていれば達成。達成：次の自分ターンの通常攻撃可能回数+1。未達成：次の自分ターンの通常攻撃可能回数-1（最低0）。",directive:true,canPlay:()=>false },
      directiveConstant: { name:"指令：定数",cost:1,type:"指令 / 使用不可",text:"このカードは使用できない。引いた時に1～4を指定する。ターン終了時、相手のどちらかの手が指定値なら達成：カードを2枚引く。未達成：相手の0ではないランダムな手を指定値へ1近づける。",directive:true,canPlay:()=>false },
      reinterpretation: { name:"再解釈",cost:1,type:"補助",text:"自分の手札にあるランダムな指定内容を持つ「指令」を1枚選ぶ。その指令の指定内容を一度だけ引き直す。",canPlay:player=>getReinterpretationCandidates(player).length>0,effect:player=>useReinterpretation(player) },
      naturalFaith: { name:"当然の信心",cost:2,type:"補助",text:"この試合中に達成した「指令」が5つ以上なら使用できる。このターン、自分の「指令」はすべて達成したものとして扱う。このカードを使用するたび、この試合中のこのカードの使用条件に必要な指令達成数を5増やす。",canPlay:player=>Number(state.directiveTotalClears?.[player]||0)>=5*(Number(state.naturalFaithUses?.[player]||0)+1),effect:player=>useNaturalFaith(player) },
      divineProof: { name:"神意の証明",cost:3,type:"補助",text:"この試合中に達成した「指令」が10以上なら使用できる。次の自分のターン開始時、「DEUS VULT」を1枚手札に加える。その後、自分の手札と山札にある「神意の証明」をすべて捨てる。この効果は1試合に1度しか発動できない。",canPlay:player=>Number(state.directiveTotalClears?.[player]||0)>=10&&!state.divineProofUsed?.[player],effect:player=>useDivineProof(player) },
      deusVult: { name:"DEUS VULT",cost:0,type:"終端 / 生成カード",text:"終端。この試合中に達成した「指令」の数の半分（小数点以下切り捨て）の回数だけ、自分と相手の0ではない手からランダムに1つ選び、その手に1本加える。",token:true,terminal:true,canPlay:()=>true,effect:player=>useDeusVult(player) },
      meaningOfDirective: {
        name: "指令の意味",
        cost: 2,
        type: "補助",
        text: "次の自分のターン開始時、山札から「指令」カードをランダムに最大2枚手札に加える。",
        canPlay: () => true,
        effect: (player) => {
          state.pendingDirectiveDraw[player] = (state.pendingDirectiveDraw[player] || 0) + 2;
          addLog(`${handNames[player]}は「指令の意味」を使用。次の自分のターン開始時、山札から指令を最大2枚加える。`);
        }
      },
      circulatingCity: {
        name: "循環する都市",
        cost: 1,
        type: "補助",
        text: "自分の捨て札にある「指令」カードをすべて山札に戻し、山札をシャッフルする。",
        canPlay: (player) => state.discard[player].some(id => isDirectiveCard(id)),
        effect: (player) => {
          const returned = [];
          state.discard[player] = state.discard[player].filter(id => {
            if (!isDirectiveCard(id)) return true;
            returned.push(directiveBaseId(id));
            return false;
          });
          state.decks[player].push(...returned);
          state.decks[player] = shuffle(state.decks[player]);
          addLog(`${handNames[player]}は「循環する都市」で指令${returned.length}枚を山札に戻した。`);
        }
      },
      directiveBlessing: {
        name: "指令の加護",
        cost: 3,
        type: "加護",
        text: "自分のターン終了時、達成した指令の数を記録する。次の相手ターン中、この手が攻撃・カード効果で加えられる本数をその数だけ減らす。ただし最低1。1本の効果には見た目上の減少が起きない。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      willBlade: {
        name: "意志の剣",
        cost: 3,
        type: "加護",
        text: "前の自分のターンに達成した指令の数だけ、この手を使った通常攻撃で対象に加える本数を増やす。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      cityWill: {
        name: "都市の意志",
        cost: 2,
        type: "補助",
        text: "自分の手札にある「指令」カードを1枚選び、相手の手札に移す。指定内容はそのまま引き継ぐ。",
        canPlay: (player) => state.hands[player].some(id => isDirectiveCard(id)),
        effect: async (player) => {
          const choices = state.hands[player]
            .map((id, index) => ({ id, index }))
            .filter(x => isDirectiveCard(x.id));
          if (!choices.length) {
            addLog(`${handNames[player]}の「都市の意志」は対象となる指令が存在しないため不発。`);
            return;
          }
          if (player === "human") {
            state.mode = "cityWillChoose";
            setMessage("「都市の意志」：相手に渡す指令を選んでください。");
            return;
          }
          const picked = choices[Math.floor(Math.random() * choices.length)];
          transferDirective(player, picked.index);
        }
      },


      ominousPower: {
        name: "不吉な力",
        cost: 2,
        type: "補助",
        text: "このターン終了時、このターンに達成した「指令」が3つ以上なら、次の自分のターン開始時に「意志の奔流」を1枚手札に加える。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].ominousPower = true;
          addLog(`${handNames[player]}は「不吉な力」を使用。このターンに指令を3つ以上達成すれば、次の自分のターンに「意志の奔流」を得る。`);
        }
      },
      willTorrent: {
        name: "意志の奔流",
        cost: 0,
        type: "終端 / 生成カード",
        text: "山札から「指令」カードをすべて手札に加える。その後、自分の手札にある「指令」カードをすべて相手に渡し、ターンを終了する。",
        token: true,
        terminal: true,
        canPlay: () => true,
        effect: async (player) => {
          await resolveWillTorrent(player);
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
        type: "終端 / 銃",
        gun: true,
        text: "自分の両手が1以上でなければ不発。自分の手を1つ選ぶ。その手で、もう片方の自分の手を通常攻撃する。この通常攻撃で攻撃対象の手をちょうど5にした場合、相手の1以上の手に3本ずつ加える。この通常攻撃では対象変更できない。",
        canPlay: (player) => state[player].L > 0 && state[player].R > 0,
        terminal: true,
        effect: async (player) => {
          if (state[player].L <= 0 || state[player].R <= 0) {
            addLog(`${handNames[player]}の「凶弾」は両手が1以上ではないため不発。`);
            return;
          }
          if (player === "human") {
            state.mode = "cursedBullet";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
        cost: 2,
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
        text: "このターンと次の自分のターン、自分はカード使用・罠設置・分けるができない。その間、自分の通常攻撃で加える本数+2。さらに、その通常攻撃で対象の手が7以上になったとき、超過処理をせず0にする。",
        canPlay: () => true,
        effect: (player) => {
          state.berserkerTurns[player] = Math.max(state.berserkerTurns[player], 2);
          state.temp[player].berserkerJustUsed = true;
          addLog(`${handNames[player]}は「バーサーカー」を使った。2ターンの間、攻撃+2、分けるとカード使用不可。攻撃で対象が7以上になった場合は超過処理をせず0にする。`);
        }
      },
      calmDown: {
        name: "落ち着ける",
        cost: 1,
        type: "補助",
        text: "手札を1枚選んで捨てる。その後、カードを2枚引く。",
        canPlay: (player) => countHandCards(player) > 1,
        effect: async (player) => {
          if (player === "human") {
            state.mode = "calmDownDiscard";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
            setMessage("「落ち着ける」：捨てる手札を1枚選んでください。その後2枚引きます。");
            return;
          }
          const discardIndex = chooseCpuDiscardIndex();
          if (discardIndex < 0) return;
          const discarded = await discardHandCardByEffect(player, discardIndex);
          drawCard(player);
          drawCard(player);
          addLog(`${handNames[player]}は「落ち着ける」で「${CARD_LIBRARY[discarded].name}」を捨て、2枚引いた。`);
        }
      },

      allegro: {
        name: "アレグロ",
        cost: 2,
        type: "補助",
        text: "このターン、自分が初めて共鳴を発生させたとき、カードを2枚引く。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].allegro = true;
          state.temp[player].allegroTriggered = false;
          addLog(`${handNames[player]}は「アレグロ」を使った。このターン最初の共鳴で2枚引く。`);
        }
      },
      resonanceTuning: {
        name: "共鳴調節",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手の共鳴判定では、攻撃対象の手との本数差が1以下なら共鳴として扱う。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      crescendo: {
        name: "クレッシェンド",
        cost: 3,
        type: "補助",
        text: "このターン、自分の共鳴した通常攻撃で加える本数+2。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].crescendo = true;
          addLog(`${handNames[player]}は「クレッシェンド」を使った。このターン、共鳴した通常攻撃で加える本数+2。`);
        }
      },
      dance: {
        name: "乱舞",
        cost: 2,
        type: "補助",
        text: "このターン、次の自分の攻撃行動を置換攻撃にする。攻撃対象の手の本数を、攻撃した手と同じ本数にする。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].dance = true;
          addLog(`${handNames[player]}は「乱舞」を使った。次の攻撃はダメージの代わりに本数を揃える。`);
        }
      },
      largo: {
        name: "ラルゴ",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手の通常攻撃が共鳴する場合、その通常攻撃で加える本数+1。さらに、この手で共鳴を発生させたときカードを1枚引く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      andante: {
        name: "アンダンテ",
        cost: 2,
        type: "補助",
        text: "自分の0でない手を1つ選ぶ。その手の本数を1増やすか1減らす。この効果で0にはできない。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] > 0),
        effect: (player) => {
          if (player === "human") {
            state.mode = "andante";
            state.pendingAndanteHand = null;
            state.selectedAttackHand = null;
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
            elements.andanteBox.classList.remove("active");
            setMessage("「アンダンテ」：微調整する自分の0でない手を選んでください。");
            return;
          }
          const choices = ["L", "R"].filter(h => state[player][h] > 0);
          const opponent = player === "human" ? "cpu" : "human";
          let best = null;
          for (const hand of choices) {
            for (const delta of [-1, 1]) {
              const value = state[player][hand] + delta;
              if (value <= 0 || value > 4) continue;
              const distance = Math.min(...["L", "R"].filter(h => state[opponent][h] > 0).map(h => Math.abs(value - state[opponent][h])), 99);
              if (!best || distance < best.distance) best = { hand, delta, value, distance };
            }
          }
          if (!best) return;
          const before = state[player][best.hand];
          state[player][best.hand] = best.value;
          addLog(`${handNames[player]}は「アンダンテ」で${handNames[best.hand]}を${before}→${best.value}に微調整した。`);
        }
      },
      lastMelody: {
        name: "最後の旋律",
        cost: 3,
        type: "補助",
        text: "このターン、自分が次に共鳴を発生させたとき、その共鳴を発生させた手を0にする。実際に0にしたなら、手札に「フィナーレ」を1枚加える。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].lastMelody = true;
          addLog(`${handNames[player]}は「最後の旋律」を使った。次の共鳴で、その手は0になる。`);
        }
      },
      finale: {
        name: "フィナーレ",
        cost: 0,
        type: "終端 / 使用不可デッキ投入",
        text: "このカードはデッキに入れられない。相手の0でない両手それぞれに、自分の左右の手の合計本数分を加える。このカードを使ったら、ターンを終了する。",
        token: true,
        terminal: true,
        canPlay: () => true,
        effect: async (player) => {
          await applyFinale(player);
          state.pendingTerminalEnd[player] = true;
        }
      },
      encore: { name:"アンコール",cost:1,type:"補助",text:"自分の捨て札にある「フィナーレ」をランダムに1枚山札に戻し、山札をシャッフルする。",canPlay:()=>true,effect:player=>useEncore(player) },
      daCapo: { name:"ダ・カーポ",cost:3,type:"終端",text:"終端。残りの手札をすべて捨て、同じ枚数引く。その後、両手を1にし、手札と山札の「ダ・カーポ」をすべて捨てる。",terminal:true,canPlay:()=>true,effect:player=>useDaCapo(player) },
      themeSetting: { name:"題目設定",cost:1,type:"特殊",text:"デッキ1枚制限。初期手札へ追加され、通常の手札枚数に数えず、外部効果で捨てられない。使用時、題目：セレナーデか題目：ロンドを両手へ付与し、このターン手札からカードをあと1枚使用できる。演舞は最大Ⅵで、Ⅴ以上の間は一部の輪舞曲が強化される。",protectedSpecial:true,countsAsHandCard:false,discardable:false,advanceNoticeExcluded:true,maxDeckCopies:1,canPlay:player=>!state.selectedTheme?.[player],effect:player=>chooseThemeV153(player) },
      serenadeTheme: { name:"題目：セレナーデ",cost:0,type:"加護 / 題目",text:"共鳴が発生するたび「演舞」を2上げる。自分のターン中に一度も共鳴が発生しなかった場合、ターン終了時に「演舞」を1下げる。「演舞」は最大Ⅵで、Ⅴ以上の間は一部の「輪舞曲」が強化される。外部効果で除去・交換されない。",blessing:true,themeBlessing:true,token:true,canPlay:()=>false },
      rondoTheme: { name:"題目：ロンド",cost:0,type:"加護 / 題目",text:"初めて使用する「輪舞曲」カードで「演舞」を2上げる。使用済みの「輪舞曲」の再使用、または輪舞曲ではないカードの使用で1下げる。変化前と変化後は別カードとして数える。「演舞」は最大Ⅵで、Ⅴ以上の間は一部の「輪舞曲」が強化される。",blessing:true,themeBlessing:true,token:true,canPlay:()=>false },
      performance: { name:"演舞",cost:0,type:"特殊状態",text:"デッキ投入不可。通常の手札枚数に数えない。演舞Ⅰ～Ⅵのレベルを持ち、Ⅴ以上の間は一部の輪舞曲が強化される。外部効果で捨てられず、レベルが0になると消滅する。",protectedSpecial:true,countsAsHandCard:false,discardable:false,token:true,canPlay:()=>false },
      fermata: { name:"フェルマータ",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。カードを1枚引く。その後、望むならさらに1枚引き、ターンを終了する。",rondo:true,rondoFamily:"fermata",canPlay:()=>true,effect:player=>useFermataV153(player) },
      canon: { name:"カノン",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。次の通常攻撃で本来加える最終的な本数と最終対象を記録し、その攻撃で実際に加える本数を0にする。次の相手ターン終了時、記録対象が0でなければ記録した本数を加える。",rondo:true,rondoFamily:"canon",canPlay:()=>true,effect:player=>{state.temp[player].canon=true;} },
      quarterRest: { name:"4分休符",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。次の相手ターンと自分の次のターン、手札からカードを使用できない。",rondo:true,rondoFamily:"rest",canPlay:()=>true,effect:player=>useQuarterRest(player) },
      ritardando: { name:"リタルダント",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。相手の0ではない両手を1本ずつ減らす。最低0。次の相手ターン中、相手はカードを引くことができない。",token:true,rondo:true,rondoFamily:"fermata",canPlay:()=>true,effect:player=>useRitardando(player) },
      arpeggio: { name:"アルペジオ",cost:2,type:"終端 / 輪舞曲",text:"輪舞曲。終端。自分の生存手の本数を相手の両手へ分配して加える。",rondo:true,rondoFamily:"canon",token:true,terminal:true,canPlay:player=>state[player].L>0||state[player].R>0,effect:player=>useArpeggioV153(player) },
      wholeRest: { name:"全休符",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。次の相手ターン、通常ドローと通常攻撃を封じる。そのターン、カードを使用できなくなった時、ターンを終了する。",rondo:true,rondoFamily:"rest",token:true,canPlay:()=>true,effect:player=>useWholeRest(player) },
      agitato: { name:"Agitato",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分と相手は、それぞれ手札をランダムに1枚捨てる。",rondo:true,rondoFamily:"agitato",canPlay:()=>true,effect:player=>useAgitato(player) },
      furioso: { name:"Furioso",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。このターン、自分の手札にある「輪舞曲」カードの枚数まで通常攻撃できる。この効果で現在の通常攻撃可能回数が減ることはない。その後、「演舞」のレベルを5下げる。次の自分のターン、行動不能になる。",rondo:true,rondoFamily:"agitato",token:true,canPlay:()=>true,effect:player=>useFurioso(player) },
      doloroso: { name:"Doloroso",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分の0ではない手を1つ選んで0にし、カードを3枚引く。",rondo:true,rondoFamily:"doloroso",canPlay:player=>state[player].L>0||state[player].R>0,effect:player=>useDolorosoV153(player) },
      appassionato: { name:"Appassionato",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。このカードの効果は1ターンに1度しか発動できない。自分の0ではない手を1つ選び、その手を0にする。このターン、手札からカードをあと2枚使用できる。次の自分のターン、カードを使用できない。",rondo:true,rondoFamily:"doloroso",token:true,canPlay:player=>(state[player].L>0||state[player].R>0)&&!state.temp[player]?.appassionatoUsedThisTurn,effect:player=>useAppassionatoV153(player) },
      lacrimosa: { name:"Lacrimosa",cost:2,type:"終端 / 輪舞曲",text:"輪舞曲。終端。自分の2回目のターン以降、相手の両手が1以上の時に使用できる。自分の手を1つ0にした後、相手の手を1つ0にする。",rondo:true,rondoFamily:"lacrimosa",terminal:true,canPlay:player=>Number(state.personalTurnCount?.[player]||0)>=2&&(state[player].L>0||state[player].R>0)&&state[otherPlayer(player)].L>0&&state[otherPlayer(player)].R>0,effect:player=>useLacrimosaV153(player) },
      requiem: { name:"Requiem",cost:2,type:"終端 / 輪舞曲",text:"輪舞曲。終端。自分の2回目のターン以降に使用できる。自分の0ではない手を1つ0にし、相手の外部効果で捨てられる手札をすべて捨てる。",rondo:true,rondoFamily:"lacrimosa",token:true,terminal:true,canPlay:player=>Number(state.personalTurnCount?.[player]||0)>=2&&(state[player].L>0||state[player].R>0),effect:player=>useRequiemV153(player) },
      morendo: { name:"Morendo",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分と相手の0ではない手をそれぞれランダムに1つ選び、その手を1にする。",rondo:true,rondoFamily:"morendo",canPlay:()=>true,effect:player=>useMorendo(player) },
      grandioso: { name:"Grandioso",cost:3,type:"終端 / 輪舞曲",text:"輪舞曲。終端。自分と相手の0ではないすべての手に2本ずつ加える。",rondo:true,rondoFamily:"grandioso",terminal:true,canPlay:()=>true,effect:player=>useGrandioso(player) },
      portamento: { name:"ポルタメント",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分の0ではない手を1つ選び、その手を1本増やす。その後、選ばなかった手が0でなければ1本減らす。",rondo:true,rondoFamily:"portamento",canPlay:player=>state[player].L>0||state[player].R>0,effect:player=>usePortamentoV153(player) },
      dissonance: { name:"ディソナンス",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分の0ではない手を1つ選び、その手でもう片方の自分の手を通常攻撃する。攻撃対象の手は0でもよい。共鳴は攻撃開始時の本数で判定する。",rondo:true,rondoFamily:"portamento",token:true,canPlay:player=>state[player].L>0||state[player].R>0,effect:player=>useDissonanceV153(player) },
      presto: { name:"プレスト",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。次の自分の通常攻撃で加える本数を、+1、0、-1、-2のいずれかランダムに変化させる。負の値では対象の手を減らし、0未満にはしない。",rondo:true,rondoFamily:"presto",canPlay:()=>true,effect:player=>usePresto(player) },
      sforzando: { name:"スフォルツァント",cost:2,type:"補助 / 輪舞曲",text:"輪舞曲。自分と相手の0ではない手から1つ選ぶ。その手の現在の本数分、このターン、自分の通常攻撃で加える本数を増加させる。",rondo:true,rondoFamily:"presto",token:true,canPlay:()=>true,effect:player=>useSforzandoV153(player) },

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
        text: "【攻撃判定前・自動】この手が攻撃対象になったとき、その攻撃で加える本数-1。ただし1未満にならない。乱舞には発動しない。",
        trap: true,
        manual: false,
        triggerTiming: "before",
        canTrigger: ({ placedHand, targetHand, incomingPower }) => {
          return placedHand === targetHand && incomingPower > 1;
        },
        trigger: () => {
          addLog("罠「ぬかるみ」により、この攻撃で加える本数-1。");
          return { powerDelta: -1 };
        }
      },
      partingGift: {
        name: "置き土産",
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・自動】この手が攻撃で0になったとき発動する。攻撃した相手は手札をランダムに1枚捨てる。手札がない場合も発動するが、捨て札効果は発生しない。",
        trap: true,
        manual: false,
        triggerTiming: "after",
        canTrigger: ({ placedHand, targetHand, resolvedFinal }) => {
          return placedHand === targetHand && resolvedFinal === 0;
        },
        trigger: async ({ attacker }) => {
          const discarded = await discardOneCard(attacker);
          if (discarded) {
            addLog(`罠「置き土産」により、${handNames[attacker]}は「${CARD_LIBRARY[discarded]?.name || discarded}」を捨てた。`);
          } else {
            addLog(`罠「置き土産」が発動したが、${handNames[attacker]}の手札が0枚だったため捨てられなかった。`);
          }
          return {};
        }
      },
      thornTrap: {
        name: "茨",
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・自動】この手が攻撃された後、攻撃してきた手に1本加える。この手が0になっても発動する。",
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
        cost: 2,
        type: "罠",
        text: "【攻撃判定後・手動】この手が攻撃された後、この手が0でなければ発動できる。攻撃してきた手に、この手の本数を加える。",
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
        text: "【攻撃判定後・手動】この手が攻撃された後、攻撃計算後のこの手が0でなければ発動できる。この手と、攻撃してきた手の本数を入れ替える。",
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
          if (!hasOwnCurse(player)) { addLog(`${handNames[player]}の「解呪」は対象が存在しないため不発。`); return; }
          if (player === "human") {
            state.mode = "chooseOwnCurse";
            state.selectedAttackHand = null;
            state.selectedTrapCardIndex = null;
            state.pendingTrapTargetEffect = "dispel";
            elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
        text: "自分の手に表向きで置く。この手の通常攻撃で加える本数+1。手が0になったら捨て札に置く。",
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
      bulletproofVest: {
        name: "防弾チョッキ",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手は「銃」カードによる攻撃と「狙撃」を受けない。ただし「ロジックアトリエ」の効果は防げない。手が0になったら捨て札に置く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      growthBlessing: {
        name: "成長",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手で通常攻撃したとき、攻撃対象を5にしたならカードを1枚引く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      recklessBlessing: {
        name: "捨て身",
        cost: 3,
        type: "加護",
        text: "自分の手に表向きで置く。この手の通常攻撃で加える本数+2。通常攻撃した後、この手に1本加える。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      ricochetBlessing: {
        name: "跳弾",
        cost: 3,
        type: "加護",
        text: "自分の手に表向きで置く。この手で相手を通常攻撃した後、相手のもう片方の手にこの手の本数の半分、切り捨ての本数を加える。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      magicalHatred: {
        name: "憎悪", cost: 2, type: "加護 / 魔法少女",
        text: "自分の手に表向きで置く。この手の通常攻撃で加える本数+1。通常攻撃するたび手札をランダムに1枚捨てる。虚無で「愛」へ変化する。",
        blessing: true, magicalCore: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      magicalDespair: {
        name: "絶望", cost: 2, type: "加護 / 魔法少女",
        text: "この手が攻撃を受けるとき本数-1（最低0）。攻撃後、自分のもう片方の手に1本加える。虚無で「正義」へ変化する。",
        blessing: true, magicalCore: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      magicalGreed: {
        name: "貪欲", cost: 2, type: "加護 / 魔法少女",
        text: "自分のターン開始時、カードを2枚引いた後、手札をランダムに2枚捨てる。虚無で「幸福」へ変化する。",
        blessing: true, magicalCore: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      magicalWrath: {
        name: "憤怒", cost: 2, type: "加護 / 魔法少女",
        text: "自分のターン開始時、追加でカードを1枚引く。この手で通常攻撃すると、攻撃対象が攻撃した手以外の生存している手からランダムに決まる。虚無で「勇気」へ変化する。",
        blessing: true, magicalCore: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      magicalLove: {
        name: "愛", cost: 2, type: "加護 / 魔法少女・変身後",
        text: "この手の通常攻撃で加える本数+1。通常攻撃時、自分のもう片方が4なら-1、1か2なら+1する。疲弊による本数変化を受けない。",
        blessing: true, token: true, magicalTransformed: true, magicalColor: "love",
        canPlay: () => false
      },
      magicalJustice: {
        name: "正義", cost: 2, type: "加護 / 魔法少女・変身後",
        text: "自分の両手が受ける攻撃の本数-2（最低1）。相手の罠を常に公開する。疲弊による本数変化を受けない。",
        blessing: true, token: true, magicalTransformed: true, magicalColor: "justice",
        canPlay: () => false
      },
      magicalHappiness: {
        name: "幸福", cost: 2, type: "加護 / 魔法少女・変身後",
        text: "この手で通常攻撃した後、カードを2枚引き、相手は手札をランダムに1枚捨てる。疲弊による本数変化を受けない。",
        blessing: true, token: true, magicalTransformed: true, magicalColor: "happiness",
        canPlay: () => false
      },
      magicalCourage: {
        name: "勇気", cost: 2, type: "加護 / 魔法少女・変身後",
        text: "この手の通常攻撃で加える本数+1。「勇気」が自分の場にある間、自分の通常攻撃で相手の手を7以上にした場合、超過処理を行わず0にする。疲弊による本数変化を受けない。",
        blessing: true, token: true, magicalTransformed: true, magicalColor: "courage",
        canPlay: () => false
      },
      wornHope: {
        name: "すり減る希望", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "手札を1枚選んで捨てる。その後、捨て札の「憎悪」「絶望」「貪欲」「憤怒」「虚無」から1枚を選び、山札へ戻してシャッフルする。",
        magicalEvolutionBase: true,
        canPlay: (player) => countHandCards(player) > 1 && (
          state.discard[player].some(id => ["magicalHatred","magicalDespair","magicalGreed","magicalWrath","magicalVoid"].includes(id)) ||
          state.hands[player].some(id => id !== "wornHope" && isExternallyDiscardableHandCard(id) && ["magicalHatred","magicalDespair","magicalGreed","magicalWrath","magicalVoid"].includes(id))
        ),
        effect: async (player) => { await useWornHope(player); }
      },
      togetherWithFriends: {
        name: "仲間と共に", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "自分の捨て札が1枚以上ある時のみ使用可能。捨て札からランダムに最大3枚を山札へ戻してシャッフルし、カードを3枚引く。",
        token: true, magicalEvolution: true,
        canPlay: (player) => state.discard[player].length > 0,
        effect: (player) => useTogetherWithFriends(player)
      },
      hysteria: {
        name: "ヒステリー", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "手札にある加護カードを1枚選んで捨てる。その後、山札からデッキ投入可能な加護カードをランダムに1枚手札へ加える。",
        magicalEvolutionBase: true,
        canPlay: (player) => state.hands[player].some(id => id !== "hysteria" && CARD_LIBRARY[id]?.blessing && isExternallyDiscardableHandCard(id)) && state.decks[player].some(id => CARD_LIBRARY[id]?.blessing && !CARD_LIBRARY[id]?.token),
        effect: async (player) => { await useHysteria(player); }
      },
      withLove: {
        name: "愛で！", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "自分の手を1つ選んで2にする。0の手も選べる。その後、カードを1枚引く。",
        token: true, magicalEvolution: true, canPlay: () => true,
        effect: (player) => beginWithLove(player)
      },
      fadedCreed: {
        name: "色褪せた信条", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "生存している自分の手をランダムに1つ選び、1本加える。次の相手ターン終了時まで、攻撃で受ける本数を-1する（最低1）。",
        magicalEvolutionBase: true,
        canPlay: (player) => ["L","R"].some(h => state[player][h] > 0),
        effect: async (player) => { await useFadedCreed(player); }
      },
      knightCreed: {
        name: "騎士の信条", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "次の相手ターン終了時まで、相手の通常攻撃によって自分の手の本数が変化しない。",
        token: true, magicalEvolution: true, canPlay: () => true,
        effect: (player) => { state.temp[player].knightCreed = true; addLog(`${handNames[player]}は「騎士の信条」を掲げた。`); }
      },
      intemperance: {
        name: "無節制", cost: 3, type: "終端 / 魔法少女・感情変化",
        text: "終端。自分の生存している両手に1本ずつ加え、カードを3枚引く。次の自分のターン、カードを使用できない。",
        terminal: true, magicalEvolutionBase: true,
        canPlay: (player) => ["L","R"].some(h => state[player][h] > 0),
        effect: async (player) => {
          for (const h of ["L", "R"]) {
            if (state[player][h] > 0) await addFingersWithCalculation(player, h, 1, "無節制");
          }
          drawCard(player);
          drawCard(player);
          drawCard(player);
          state.pendingIntemperanceCardLock[player] = true;
          state.pendingCardUseLockSource[player] = "intemperance";
          addLog(`${handNames[player]}は「無節制」の代償により、次の自分ターンはカードを使用できない。`);
          state.pendingTerminalEnd[player] = true;
        }
      },
      goldMadness: {
        name: "黄金狂", cost: 3, type: "補助 / 魔法少女・変身後",
        text: "このカードの使用後、このターン中にさらにカードを2枚使用できる。このカードは1ターンに1枚しか使用できない。",
        token: true, magicalEvolution: true,
        canPlay: (player) => !state.temp[player].goldMadnessUsed,
        effect: (player) => { state.temp[player].goldMadnessUsed = true; state.temp[player].cardExtraUses = (state.temp[player].cardExtraUses || 0) + 2; addLog(`${handNames[player]}は「黄金狂」により、このターンさらにカードを2枚使用できる。`); }
      },
      betrayedHeart: {
        name: "裏切られた心", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "自分の手を1つ選び、1本加える。このターン、自分の通常攻撃で加える本数-1（最低1）。",
        magicalEvolutionBase: true,
        canPlay: (player) => ["L","R"].some(h => state[player][h] > 0),
        effect: (player) => beginBetrayedHeart(player)
      },
      friendship: {
        name: "友情", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "このターン、通常攻撃可能回数を2回にする。このカードは1ターンに1枚しか使用できない。",
        token: true, magicalEvolution: true,
        canPlay: (player) => !state.temp[player].friendshipUsed,
        effect: (player) => { state.temp[player].friendshipUsed = true; state.temp[player].attackLimit = Math.max(2, state.temp[player].attackLimit || 1); state.temp[player].multiAttackSource = "友情"; addLog(`${handNames[player]}は「友情」により、このターン通常攻撃を2回まで行える。`); }
      },
      emptyHeart: {
        name: "空虚な心", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "このカード以外の自分の手札をすべて捨てる。次の自分のターン開始時、捨てた枚数分カードを引く。",
        magicalEvolutionBase: true, canPlay: () => true,
        effect: async (player) => { await useEmptyHeart(player); }
      },
      fullHeart: {
        name: "満ちる心", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "手札から1枚以上、好きな枚数を選んで捨てる。相手は同じ枚数だけ手札をランダムに捨てる。",
        token: true, magicalEvolution: true,
        canPlay: (player) => countHandCards(player) > 1,
        effect: async (player) => { await useFullHeartV153(player); }
      },
      magicalChant: {
        name: "魔法少女の詠唱", cost: 2, type: "補助 / 魔法少女・詠唱",
        text: "詠唱を1進める。進捗は自分のすべての同名カードで共有する。未完成なら使用後にこのカードを山札へ戻してシャッフルする。詠唱が3に達すると、この試合中すべての同名カードが「アルカナ・スレイブ！！」へ変化する。愛・正義・幸福・勇気のいずれかがあれば、進捗に関係なく変化後として使用できる。",
        magicalChant: true,
        canPlay: () => true,
        effect: async (player) => { await useMagicalChant(player); }
      },
      arcanaSlave: {
        name: "アルカナ・スレイブ！！", cost: 2, type: "終端 / 魔法少女・詠唱完成",
        text: "終端。相手の0ではない手を1つ選び、0にする。",
        token: true, magicalEvolution: true, terminal: true,
        canPlay: (player) => ["L","R"].some(h => state[otherPlayer(player)][h] > 0),
        effect: async (player) => { await beginArcanaSlave(player); }
      },
      frenzy: {
        name: "狂乱", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "次の通常攻撃で加える本数+2。その通常攻撃の対象は、相手の生存している手と自分のもう片方の生存している手からランダムに選ばれる。",
        magicalEvolutionBase: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].frenzyAttack = true;
          addLog(`${handNames[player]}は「狂乱」を使用。次の攻撃は+2され、対象がランダムになる。`);
        }
      },
      rationalPower: {
        name: "理性ある力", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "次の通常攻撃で加える本数+1。相手の手を通常攻撃したとき、相手のもう片方の手にも同じ本数を加える。追加効果では罠・共鳴・攻撃時効果は発動しない。",
        token: true, magicalEvolution: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].rationalPowerAttack = true;
          addLog(`${handNames[player]}は「理性ある力」を使用。次の攻撃は+1され、相手のもう片方にも同じ本数を与える。`);
        }
      },
      selfRighteousness: {
        name: "独善", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "次の通常攻撃で加える本数+2。その通常攻撃で攻撃対象の手を0にできなかった場合、自分の攻撃した手に2本加える。対象が変更された場合は変更後の対象で判定する。",
        magicalEvolutionBase: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].selfRighteousAttack = true;
          addLog(`${handNames[player]}は「独善」を使用。次の通常攻撃で加える本数+2。攻撃対象を0にできなければ反動を受ける。`);
        }
      },
      justiceForEveryone: {
        name: "みんなのための正義", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "次の通常攻撃で加える本数+1。その通常攻撃で攻撃対象の手を0にした場合、自分のもう片方の手を1にする。0の手も対象になる。対象が変更された場合は変更後の対象で判定する。",
        token: true, magicalEvolution: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].justiceForEveryoneAttack = true;
          addLog(`${handNames[player]}は「みんなのための正義」を使用。次の通常攻撃で加える本数+1。攻撃対象を0にすれば、もう片方の手を1にする。`);
        }
      },
      villainMark: {
        name: "悪党の印", cost: 2, type: "呪縛 / 魔法少女",
        text: "相手の手に表向きで置く。この手が通常攻撃されたとき、その通常攻撃で加える本数+1し、攻撃したプレイヤーはカードを1枚引く。1ターンに何度でも発動する。",
        curse: true, magicalCore: true,
        canPlay: (player) => canPlaceAttachment(player, otherPlayer(player))
      },
      tearSharpenedSword: {
        name: "涙で研ぎ澄まされた剣", cost: 2, type: "補助 / 魔法少女",
        text: "次の通常攻撃時、対象変更後の攻撃対象に付いている加護をすべて捨ててから攻撃する。",
        magicalCore: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].tearSharpenedSwordAttack = true;
          addLog(`${handNames[player]}は「涙で研ぎ澄まされた剣」を構えた。次の攻撃対象の加護をすべて捨てる。`);
        }
      },
      goldRush: {
        name: "ゴールドラッシュ", cost: 2, type: "補助 / 魔法少女",
        text: "次の通常攻撃で加える本数を、攻撃時の自分の手札枚数に置換する。この置換値には通常攻撃で加える本数への増減を適用しない。",
        magicalCore: true,
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].goldRushAttack = true;
          addLog(`${handNames[player]}は「ゴールドラッシュ」を使用。次の攻撃の基本本数は攻撃時の手札枚数になる。`);
        }
      },
      voidEqualization: {
        name: "空虚", cost: 2, type: "終端 / 魔法少女",
        text: "終端。相手の手札が自分より多い場合、自分と同じ枚数になるまで相手の手札をランダムに捨てさせる。自分の方が多い、または同数なら何も起こらない。",
        terminal: true, magicalCore: true,
        canPlay: () => true,
        effect: async (player) => {
          const opponent = otherPlayer(player);
          const difference = Math.max(0, countHandCards(opponent) - countHandCards(player));
          if (difference > 0) {
            const discarded = await discardRandomCards(opponent, difference, "「空虚」");
            addLog(`${handNames[player]}の「空虚」により、${handNames[opponent]}は手札を${discarded}枚捨て、通常手札${countHandCards(opponent)}枚になった。`);
          } else {
            addLog(`${handNames[player]}は「空虚」を使用したが、相手の手札は自分より多くないため何も起こらなかった。`);
          }
          state.pendingTerminalEnd[player] = true;
        }
      },
      sacrificePower: {
        name: "犠牲の力", cost: 2, type: "補助 / 魔法少女・感情変化",
        text: "自分の手に付いている加護を1枚以上、好きな数だけ選んで捨てる。次の通常攻撃で、捨てた加護の数だけ加える本数を増やす。",
        magicalEvolutionBase: true,
        canPlay: (player) => getOwnBlessingAttachments(player).length > 0,
        effect: async (player) => { await useSacrificePower(player); }
      },
      powerOfEveryone: {
        name: "みんなの力で", cost: 2, type: "補助 / 魔法少女・変身後",
        text: "次の通常攻撃で、攻撃時に自分の両手に付いている加護の合計数だけ加える本数を増やす。",
        token: true, magicalEvolution: true,
        canPlay: () => true,
        effect: (player) => {
          const bonus = countOwnBlessings(player);
          state.temp[player].attackBonus = Number(state.temp[player].attackBonus || 0) + bonus;
          addLog(`${handNames[player]}は「みんなの力で」を使用。場の加護${bonus}枚分、次の通常攻撃で加える本数+${bonus}。`);
        }
      },
      magicalVoid: {
        name: "虚無", cost: 2, type: "魔法少女",
        text: "憎悪・絶望・貪欲・憤怒が自分の両手に1枚ずつ揃っていなければ不発。揃っているなら、それぞれを愛・正義・幸福・勇気へ変化させる。",
        canPlay: (player) => canActivateMagicalVoid(player),
        effect: async (player) => {
          return await activateMagicalVoid(player);
        }
      },

      appeal: {
        name: "控訴", cost: 3, type: "割り込み / 天秤",
        text: "相手が終端カードを使用した時、手札から発動できる。その効果と終端を無効にし、カードを相手の手札へ戻す。相手のカード使用権を返すが、このターン同名カードは使用できない。その後、他の「控訴」はすべて「上告」に変化する。",
        canPlay: () => false,
        effect: () => {}
      },
      supremeAppeal: {
        name: "上告", cost: 3, type: "割り込み / 天秤・変化",
        text: "相手が終端カードを使用した時、手札から発動できる。その効果と終端を無効にし、カードを相手の山札へ戻してシャッフルする。相手のカード使用権を返すが、このターン同名カードは使用できない。相手の次のターン開始時に「執行」を1枚与え、その後、自分の残りの「上告」をすべて捨てる。",
        token: true,
        canPlay: () => false,
        effect: () => {}
      },

      balanceBlade: {
        name: "均衡の刃", cost: 1, type: "補助 / 天秤",
        text: "次の通常攻撃時、自分の両手の本数が等しいなら、加える本数+2。",
        canPlay: () => true,
        effect: (player) => { state.temp[player].balanceBladeAttack = true; addLog(`${handNames[player]}は「均衡の刃」を構えた。次の通常攻撃時に均衡なら加える本数+2。`); }
      },
      tuning: {
        name: "調律", cost: 2, type: "補助 / 天秤",
        text: "自分の0ではない手を1つ選び、もう片方の手と同じ本数にする。0の手がある場合は使用できない。",
        canPlay: (player) => state[player].L > 0 && state[player].R > 0,
        effect: (player) => beginTuning(player)
      },
      scalesBlessing: {
        name: "天秤の加護", cost: 2, type: "加護 / 天秤",
        text: "両手の本数が等しいなら、この手が受ける攻撃-2（最低0）。等しくないなら受ける攻撃+1。同じ手では重複しない。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      equalCondemnation: {
        name: "等価なる断罪", cost: 2, type: "終端 / 天秤",
        text: "終端。発動時、自分の両手の本数が等しくなければ不発。等しいなら、その本数を相手の0ではない両手に加える。ただし相手の両手の本数も等しい場合、この効果は無効。",
        terminal: true,
        canPlay: (player) => isBalanced(player),
        effect: async (player) => { await resolveEqualCondemnation(player); }
      },
      fairWorld: {
        name: "平等な世界", cost: 2, type: "終端 / 天秤",
        text: "終端。自分の0ではない手を1つ選ぶ。すべての0ではない手の本数を、選んだ手と同じにする。",
        terminal: true,
        canPlay: (player) => state[player].L > 0 || state[player].R > 0,
        effect: async (player) => { await beginFairWorld(player); }
      },
      balanceBenefit: {
        name: "均衡の恩恵", cost: 1, type: "補助 / 天秤",
        text: "自分の両手の本数が等しいなら自分は2枚引く。相手の両手の本数が等しいなら相手は2枚引く。それぞれ個別に判定する。",
        canPlay: (player) => isBalanced(player) || isBalanced(otherPlayer(player)),
        effect: (player) => { if(isBalanced(player)){drawCard(player);drawCard(player);} const o=otherPlayer(player); if(isBalanced(o)){drawCard(o);drawCard(o);} addLog(`${handNames[player]}は「均衡の恩恵」を使用した。`); }
      },
      unfairWorld: {
        name: "不平等な世界", cost: 2, type: "終端 / 天秤",
        text: "終端。すべての0ではない手について、それぞれ1～4をランダムに決め、その本数にする。",
        terminal: true, canPlay: () => true,
        effect: async (player) => { await resolveUnfairWorld(player); }
      },
      divinePunishment: {
        name: "天罰", cost: 2, type: "終端 / 天秤",
        text: "終端。すべての0ではない手からランダムに1つ選び、1本加える。これを4回繰り返す。各回ごとに対象を選び直す。",
        terminal: true, canPlay: () => true,
        effect: async (player) => { await resolveDivinePunishment(player); }
      },
      tiltedScales: {
        name: "傾いた天秤", cost: 2, type: "補助 / 天秤",
        text: "自分と相手の両手の合計本数を比べる。合計が少ないプレイヤーは手札をランダムに2枚捨てる。同じなら何も起こらない。",
        canPlay: () => true,
        effect: async (player) => {
          const o=otherPlayer(player), a=state[player].L+state[player].R, b=state[o].L+state[o].R;
          if (state.battleMode === "friend" && player === "human") {
            await emitFriendFx("tiltedScales", {
              leftSide: friendSideForLocalPlayer(player),
              rightSide: friendSideForLocalPlayer(o),
              leftCount: a,
              rightCount: b
            }).catch(error => console.error("PVP tilted scales fx failed", error));
          }
          await showTiltedScalesCinematic(player, a, o, b);
          if(a<b) await discardRandomCards(player,2,'「傾いた天秤」');
          else if(b<a) await discardRandomCards(o,2,'「傾いた天秤」');
          addLog(`${handNames[player]}は「傾いた天秤」を使用。合計${a}対${b}。`);
        }
      },
      finalJudgmentConfiscation: {
        name: "最終判決：没収", cost: 3, type: "終端 / 天秤・最終判決",
        text: "終端。自分の2度目のターン以降のみ使用可能。発動時、すべての0ではない手の本数が等しくなければ不発。等しいなら、相手の手札をすべて捨てる。",
        terminal: true,
        canPlay: (player) => canUseFinalJudgment(player),
        effect: async (player) => await resolveFinalJudgmentEffect(player, "没収")
      },
      finalJudgmentDeath: {
        name: "最終判決：死刑", cost: 3, type: "終端 / 天秤・最終判決",
        text: "終端。自分の2度目のターン以降のみ使用可能。発動時、すべての0ではない手の本数が等しくなければ不発。等しいなら、「執行」を2枚得る。",
        terminal: true,
        canPlay: (player) => canUseFinalJudgment(player),
        effect: async (player) => await resolveFinalJudgmentEffect(player, "死刑")
      },
      finalJudgmentPrison: {
        name: "最終判決：懲役", cost: 3, type: "終端 / 天秤・最終判決",
        text: "終端。自分の2度目のターン以降のみ使用可能。発動時、すべての0ではない手の本数が等しくなければ不発。等しいなら、相手は次の3回のターン、カードを使用できない。",
        terminal: true,
        canPlay: (player) => canUseFinalJudgment(player),
        effect: async (player) => await resolveFinalJudgmentEffect(player, "懲役")
      },
      execution: {
        name: "執行", cost: 0, type: "終端 / 生成カード・天秤",
        text: "終端。相手の0ではない手のうち、本数が多い方を0にする。同じ本数なら対象を選ぶ。",
        terminal: true, token: true,
        canPlay: (player) => state[otherPlayer(player)].L>0 || state[otherPlayer(player)].R>0,
        effect: async (player) => { await beginExecution(player); }
      },
      slowCurse: {
        name: "鈍重の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この手の通常攻撃で加える本数-1。ただし最低1。手が0になったら捨て札に置く。",
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
        text: "相手の手に表向きで置く。この手は7以上になったら、余り計算をせず0になる。",
        curse: true,
        canPlay: (player) => canPlaceAttachment(player, player === "human" ? "cpu" : "human")
      },
      immutableCurse: {
        name: "不変の呪縛",
        cost: 2,
        type: "呪縛",
        text: "相手の手に表向きで置く。この呪縛が付いている手で通常攻撃するとき、その通常攻撃で加える本数への増減をすべて無効化する。攻撃置換、受ける本数の補正、カードによる直接の本数追加には影響しない。",
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
      },
      harpoonEmbed: { name:"銛を埋める",cost:1,type:"補助 / 黄針",harpoonTheme:true,harpoonAttach:true,text:"このターンの次の通常攻撃の直前、最終的な攻撃対象の手の罠・加護・呪縛ゾーンに空きがあるなら、その手に自分の「銛」をつける。",canPlay:()=>true,effect:(p)=>{state.temp[p].harpoonEmbed=true;} },
      harpoon: { name:"銛",cost:0,type:"呪縛 / 生成カード・黄針",curse:true,token:true,harpoonTheme:true,text:"この手へ通常攻撃が命中するたび「銛-振動」を1増やす。そのターン最初の命中時のみ攻撃したプレイヤーは1枚引く。回収時、振動分を現在の付着先へ加える。" },
      harpoonThrow: { name:"銛投擲",cost:2,type:"補助 / 黄針",harpoonTheme:true,harpoonAttach:true,text:"相手の0でない手を1つ選び、自分の「銛」をつける。設置ゾーンが埋まっている場合、ランダムに1枚を捨ててからつける。",canPlay:p=>state[otherPlayer(p)].L>0||state[otherPlayer(p)].R>0,effect:async p=>await chooseAndAttachHarpoon(p,true) },
      harpoonRecover: { name:"銛回収",cost:1,type:"終端 / 補助・黄針",terminal:true,harpoonTheme:true,text:"終端。自分が付与した銛を回収する。加算前の本数と実際に加える本数の合計が7以上なら、その手を0にする。",canPlay:p=>!!findOwnedHarpoon(p),effect:async p=>await recoverHarpoon(p,{sourceLabel:"銛回収",zeroAtSeven:true}) },
      harpoonReuse: { name:"銛の再利用",cost:2,type:"補助 / 黄針",harpoonTheme:true,text:"自分の捨て札から、銛を付与する効果を持つカードをランダムに1枚山札へ戻し、山札をシャッフルする。",canPlay:()=>true,effect:p=>reuseHarpoonCard(p) },
      strikeBack: { name:"打ち返す",cost:2,type:"罠 / 黄針",trap:true,manual:true,harpoonTheme:true,text:"この手が、自分の銛がついている手から通常攻撃された時に発動できる。その銛を回収し、この攻撃で受ける本数を1減らす。",triggerTiming:"before",canTrigger:c=>!!findOwnedHarpoonAt(c.defender,c.attacker,c.attackHand),trigger:async c=>{await recoverHarpoon(c.defender,{sourceLabel:"打ち返す"});return{powerDelta:-1,allowZeroPower:true};} },
      yellowWaspNeedle: { name:"黄蜂針",cost:3,type:"補助 / 黄針",harpoonTheme:true,text:"次の自分のターン開始時、自分が付与した銛を回収する。この回収によって相手の手を0にしたなら、カードを2枚引く。",canPlay:()=>true,effect:p=>{state.pendingYellowWaspNeedle[p]=true;} },
      gungnir: { name:"グングニル",cost:3,type:"補助 / 黄針",harpoonTheme:true,harpoonAttach:true,text:"相手の0でない手を1つ選び、設置ゾーンに空きがあるなら自分の「銛」をつける。このターン終了時、自分が付与した銛を回収する。",canPlay:p=>state[otherPlayer(p)].L>0||state[otherPlayer(p)].R>0,effect:async p=>{await chooseAndAttachHarpoon(p,false);state.pendingGungnirRecovery[p]=true;} },
      doubleCarveHarpoon: { name:"二連削-銛",cost:2,type:"補助 / 黄針",harpoonTheme:true,text:"このターンの次の通常攻撃が、自分の銛がついている手へ命中したなら、解決後、同じ攻撃手で同じ手をもう一度通常攻撃する。",canPlay:()=>true,effect:p=>{state.temp[p].doubleCarveHarpoon=true;} },
      harpoonResonance: { name:"銛共鳴",cost:2,type:"補助 / 黄針",harpoonTheme:true,text:"このターンの次の通常攻撃が、自分の銛がついている手へ命中し、その攻撃で共鳴したなら、その銛の振動を3増やす。",canPlay:()=>true,effect:p=>{state.temp[p].harpoonResonance=true;} },
      balancedScales: {name:"釣り合った天秤",cost:2,type:"終端 / 天秤",terminal:true,text:"自分と相手の両手の合計が等しい時に使用できる。+1か-1を選び、自分の左手、右手、相手の左手、右手の順に、0を含む全ての手へ適用する。",canPlay:p=>v166HandTotal(p)===v166HandTotal(otherPlayer(p)),effect:async p=>await useBalancedScales(p)},
      memory: {name:"思い出",cost:2,type:"補助",text:"自分の捨て札が10枚以上ある時、その中からランダムに1枚の効果を発動する。選ばれたカードは捨て札に残る。",canPlay:p=>state.discard[p].length>=10,effect:async p=>await useMemoryCard(p)},
      sniperBlessing: {name:"狙撃の加護",cost:2,type:"加護",blessing:true,generatedCards:["supportFire"],text:"自分のターン開始時、手札に「援護射撃」を1枚加える。この加護が付いた手では攻撃できず、その手が5以上になる時は余りを計算せず0になる。",canPlay:p=>canPlaceAttachment(p,p)},
      supportFire: {name:"援護射撃",cost:0,type:"補助 / 生成カード",token:true,countsAsHandCard:false,discardable:false,consumesCardAction:false,vanishOnUse:true,vanishAtTurnEnd:true,text:"相手の0でない手を1つ選び、その手に1本加える。このカードは手札枚数に数えず、カード使用回数を消費しない。使用後またはターン終了時に、捨て札へ送られず消滅する。",canPlay:p=>["L","R"].some(h=>state[otherPlayer(p)][h]>0),effect:async p=>await useSupportFire(p)},
      vibrationGeneration: {name:"振動発電",cost:2,type:"加護 / 共鳴・充電",blessing:true,resonance:true,chargeCard:true,text:"この加護が付いた手を攻撃元として共鳴が成立した時、充電を3得る。",canPlay:p=>canPlaceAttachment(p,p)},
      cardLock: {name:"カードロック",cost:2,type:"補助",text:"自分の手札から2枚を選ぶ。選ばれたカードは次の2回の自分のターン終了まで、疲労以外では捨てられない。",canPlay:p=>getDiscardCandidates(p,"cardEffect").length>=3,effect:p=>useCardLock(p)},
      replaceAttachments: {name:"置き換える",cost:3,type:"補助",text:"自分の左右の手に設置されている加護・呪縛・罠と、それらに付随する状態を左右丸ごと入れ替える。",canPlay:()=>true,effect:p=>replaceHandAttachments(p)},
      forceCard: {name:"強制",cost:2,type:"補助",text:"相手は通常手札から1枚を選ぶ。次の相手ターン、その個体以外のカードを使用できない。対象がなくなっても選び直さない。",canPlay:p=>getCountedHandCards(otherPlayer(p)).length>0,effect:p=>useForceCard(p)},
      peek: {name:"覗き見",cost:2,type:"補助",text:"相手の通常手札からランダムに最大3枚を見る。",canPlay:()=>true,effect:async p=>await usePeek(p)},
      exchangeHands: {name:"交換",cost:3,type:"終端",terminal:true,text:"自分と相手の0でない、異なる本数の手を1つずつ選び、その本数を入れ替える。",canPlay:p=>hasV166ExchangePair(p),effect:p=>useExchangeHands(p)},
      nobleGas: {name:"貴ガス",cost:2,type:"補助",text:"自分の両手の合計が8の時に使用できる。次の自分のターン開始時まで、相手由来の効果では自分の手の本数が変化しない。",canPlay:p=>v166HandTotal(p)===8,effect:p=>{state.nobleGasProtected[p]=true;addLog(`${handNames[p]}は「貴ガス」で相手由来の本数変化を防ぐ。`)}},
      late: {name:"遅刻",cost:3,type:"終端",terminal:true,text:"次の自分のターン、攻撃可能回数が1回増える。複数予約した場合は累積する。",canPlay:()=>true,effect:p=>{state.pendingLateAttackBonus[p]=Number(state.pendingLateAttackBonus[p]||0)+1}},
      trade: {name:"貿易",cost:2,type:"補助",text:"自分と相手が、捨てられる手札を1枚ずつ秘密に選び、同時に相手へ渡す。どちらかに候補がなければ使用できない。",canPlay:p=>getTradeEligibleCards(p).length>0&&getTradeEligibleCards(otherPlayer(p)).length>0,effect:p=>useTrade(p)},
      untidy: {name:"整わない",cost:2,type:"補助",text:"相手の2以上の手を1つ選んで1本減らす。その後、自分のランダムな0でない手を1つ選び1本加える。",canPlay:p=>["L","R"].some(h=>state[otherPlayer(p)][h]>=2),effect:p=>useUntidy(p)}
    };

        const DECK_MIN_COUNT = 20;
    const DECK_MAX_COUNT = 20;

    const DEFAULT_DECK_COUNTS = {
      insight: 2,
      strongHit: 2,
      lightHit: 2,
      repair: 2,
      calm: 2,
      passCard: 1,
      deflect: 1,
      attention: 1,
      braceTrap: 1,
      dodgeTrap: 1,
      thornTrap: 1,
      powerBlessing: 2,
      slowCurse: 2
    };

    const ROMAN_PREPARATION_BLOCKED_NAMES = Object.freeze(new Set([
      "レーザービーム","エレクトリック","電磁波","固定","等価交換","狙撃","乱射","無差別射撃","ショットガン","ファニング","満ちる心","看破","探り",
      "解除","手繰り寄せ","すりかえ","DEUS VULT","意思の奔流","倹約令","控訴","上告",
      "乱舞","フィナーレ","カノン","アルペジオ","4分休符","全休符","Agitato","Lacrimosa","Requiem","Morendo",
      "アルカナ・スレイブ！！","涙で研ぎ澄まされた剣","空虚","等価なる断罪","不平等な世界","天罰","傾いた天秤","執行"
    ]));
    const ROMAN_PROTECTED_BULLET_NAMES = Object.freeze(new Set(["特殊弾","貫通弾","阻害弾","粉砕弾"]));
    const ROMAN_DECK_BANNED_NAMES = Object.freeze(new Set(["最終判決：没収","最終判決：死刑","最終判決：懲役"]));
    const REGULATION_DEFS = Object.freeze({
      standard: Object.freeze({id:"standard",version:1,name:"スタンダード",summary:"通常の対戦ルール",details:["通常のカード・デッキルールで対戦します。"],deckRestrictions:null}),
      romanGimmick: Object.freeze({
        id:"romanGimmick",version:1,name:"ロマンギミック杯",summary:"双方に3ターンずつの準備時間があり、その後は通常ルールで戦います。",preparationTurns:3,
        details:["各プレイヤーに3ターンずつ準備時間があります。","準備中も攻撃回数と攻撃した事実、共鳴、自分側トリガーは通常通りです。","相手の手・手札・設置物・妨害状態へ不利益を与える効果は無効です。","一部カードは準備時間中使用できず、一部の弾は捨てられません。"],
        preparationBlockedNames:[...ROMAN_PREPARATION_BLOCKED_NAMES],protectedBulletNames:[...ROMAN_PROTECTED_BULLET_NAMES],deckRestrictions:{finalVerdictNames:[...ROMAN_DECK_BANNED_NAMES],blockedCardNames:["フェルマータ"],blockedGroups:["harpoonTheme"]}
      })
    });
    const ROOM_TAG_DEFS = Object.freeze({beginner:"初心者歓迎",rematch:"連戦歓迎",casual:"カジュアル",advanced:"上級者向け",deck_test:"デッキ調整中"});
    const ROOM_TAG_MAX = 3;
    const PUBLIC_ROOM_LIMIT = 50;
    const ORPHAN_ROOM_GRACE_MS = 10 * 60 * 1000;
    const DEFAULT_REGULATION = Object.freeze({modeId:"standard",modeVersion:1,options:{}});

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
      deckRuleContext: null,
      currentRegulation: { ...DEFAULT_REGULATION },
      resolvingEffectPlayer: null,
      deckSortMode: "implementation",
      deckSearch: "",
      deckNameSearch: "", deckKeywordSearch: "", // 旧保存・回帰テスト互換（UIは単一検索欄）
      deckFilters: { type: "", cost: "", theme: "", deckOnly: false, unselectedOnly: false, favoriteOnly: false },
      cpuDifficulty: "standard",
      costLimit: 40,
      selectedTrapCardIndex: null,
      pendingTrapTargetEffect: null,
      pendingRepairDiscard: null,
      revealedTrapIds: new Set(),
      noSplit: { human: false, cpu: false },
      extraActions: { human: 0, cpu: 0 },
      activeExtraAction: { human: false, cpu: false },
      pendingAcceleration: { human: 0, cpu: 0 },
      activeAcceleration: { human: 0, cpu: 0 },
      pendingTerminalEnd: { human: false, cpu: false },
      pendingIntemperanceCardLock: { human: false, cpu: false },
      activeIntemperanceCardLock: { human: false, cpu: false },
      pendingCardUseLockSource: { human: "", cpu: "" },
      activeCardUseLockSource: { human: "", cpu: "" },
      judgmentPrisonTurns: { human: 0, cpu: 0 },
      pendingAppealExecution: { human: 0, cpu: 0 },
      personalTurnCount: { human: 0, cpu: 0 },
      magicalChantProgress: { human: 0, cpu: 0 },
      magicalChantCompleted: { human: false, cpu: false },
      costLimitNextTurn: { human: null, cpu: null },
      activeCostLimit: { human: null, cpu: null },
      berserkerTurns: { human: 0, cpu: 0 },
      pendingEqualTradeSelf: null,
      pendingRapidFireDiscard: null,
      pendingGunEffect: null,
      pendingFanning: null,
      pendingModulation: null,
      pendingStartDrawSkip: { human: false, cpu: false },
      selectedTheme: { human: null, cpu: null },
      performanceLevel: { human: 0, cpu: 0 },
      resonanceTriggeredThisTurn: { human: false, cpu: false },
      usedRondoFamilies: { human: [], cpu: [] },
      usedRondoCards: { human: [], cpu: [] },
      pendingDrawLock: { human: false, cpu: false },
      activeDrawLock: { human: false, cpu: false },
      pendingPrestoAttack: { human: false, cpu: false },
      sforzandoTurnBonus: { human: 0, cpu: 0 },
      pendingCanonHits: [],
      pendingYellowWaspNeedle: { human: false, cpu: false },
      pendingGungnirRecovery: { human: false, cpu: false },
      quarterRestPending: { human: 0, cpu: 0 },
      quarterRestActive: { human: false, cpu: false },
      wholeRestPending: { human: false, cpu: false },
      wholeRestActive: { human: false, cpu: false },
      pendingArpeggio: null,
      furiosoSkipPending: { human: false, cpu: false },
      furiosoSkipActive: { human: false, cpu: false },
      pendingSwapFirst: null,
      pendingAndanteHand: null,
      pendingBalanceTarget: null,
      pendingDirectiveDraw: { human: 0, cpu: 0 },
      pendingDirectiveNoDraw: { human: 0, cpu: 0 },
      pendingDirectiveBonusDraw: { human: 0, cpu: 0 },
      lastDirectiveClearCount: { human: 0, cpu: 0 },
      activeDirectiveBlessing: { human: 0, cpu: 0 },
      directiveTotalClears: { human: 0, cpu: 0 },
      naturalFaithUses: { human: 0, cpu: 0 },
      divineProofUsed: { human: false, cpu: false },
      pendingDeusVult: { human: false, cpu: false },
      pendingDirectiveHandAttackModifier: { human: { L: 0, R: 0 }, cpu: { L: 0, R: 0 } },
      pendingDirectiveNextAttackModifier: { human: 0, cpu: 0 },
      pendingDirectiveReformContinue: { human: false, cpu: false },
      activeDirectiveReformContinue: { human: false, cpu: false },
      pendingDirectiveNoSplit: { human: false, cpu: false },
      pendingDirectiveAnnihilation: { human: false, cpu: false },
      activeDirectiveAnnihilation: { human: false, cpu: false },
      pendingDirectiveAttackLimitDelta: { human: 0, cpu: 0 },
      pendingChargeStun: { human: false, cpu: false },
      pendingChargeStunSource: { human: "", cpu: "" },
      cheapBatteryDecay: { human: 0, cpu: 0 },
      energyBarrier: { human: 0, cpu: 0 },
      pendingChargeTarget: null,
      lightSpeedCircuitUsed: { human: false, cpu: false },
      pendingWillTorrent: { human: 0, cpu: 0 },
      pendingAdvanceNotice: { human: [], cpu: [] },
      firstTurnStarted: { human: false, cpu: false },
      weaknessWait: {},
      lastAction: null,
      turn: "human",
      mode: "attack",
      selectedAttackHand: null,
      animating: false,
      gameOver: false,
      matchResult: null,
      matchResultReason: null,
      cardInstanceSequence: 0,
      handCardInstances: { human: [], cpu: [] },
      cardLocks: { human: [], cpu: [] },
      forcedCard: { human: null, cpu: null },
      nobleGasProtected: { human: false, cpu: false },
      pendingLateAttackBonus: { human: 0, cpu: 0 },
      copiedEffectDepth: 0,
      surrenderedBy: null,
      startingPlayer: null,
      startingPlayerDecided: false,
      startingRouletteActive: false,
      startingFlowToken: 0,
      lastShownResultKey: null,
      friendResultPublishing: false,
      log: [],
      turnNumber: 0,
      currentScreen: "menu",
      battleMode: "cpu",
      tutorialBattleActive: false,
      tutorialScriptedCpuAction: false,
      friendRoomId: null,
      friendRoomShortCode: null,
      friendRoomUrl: null,
      friendRole: null,
      firebaseAuthReady: false,
      firebaseAuthUser: null,
      firebaseUid: null,
      firebaseAuthError: null,
      friendReady: false,
      friendUnsubscribe: null,
      friendRoomConnectTimer: null,
      friendRoomHeartbeatTimer: null,
      friendRoomData: null,
      friendMatchId: null,
      friendMatchStarted: false,
      friendSyncRevision: 0,
      friendLastAppliedRevision: 0,
      friendApplyingRemoteState: false,
      friendSnapshotHydrated: false,
      friendStartedTurnKey: "",
      friendTurnSerial: 0,
      friendTurnOwner: null,
      friendTurnStarted: false,
      friendTurnStartAppliedSerial: 0,
      friendTurnStartToken: null,
      friendTurnStartClaimedAtMs: 0,
      friendStartingTurnKey: "",
      friendTurnStartAtomicActive: false,
      friendTurnStartDeferredPublish: false,
      friendTurnStartPendingFx: [],
      friendTurnStartPendingInterruptWrites: [],
      friendTurnStartAtomicContext: null,
      friendTurnStartCommittedKeys: new Set(),
      friendTurnStartCommittedContexts: new Map(),
      friendTurnStartFlushedSideEffectIds: new Set(),
      friendTurnClaimInFlight: false,
      friendTurnClaimRetryTimer: null,
      friendTurnClaimRetryKey: "",
      friendTurnClaimRetryCount: 0,
      friendCardResolving: false,
      friendLastPublishedSignature: "",
      friendPublishTimer: null,
      friendInterruptWaiting: null,
      friendInterruptHandling: false,
      friendHandledInterruptIds: new Set(),
      friendHandledFxIds: new Set(),
      friendFxQueue: Promise.resolve(),
      friendPostMatchChoice: null,
      friendPostMatchResolutionId: null,
      friendPostMatchResolving: false,
      friendDeckEditReturnToLobby: false,
      friendSurrenderBusy: false,
      friendSurrenderNoticeAcknowledged: null,
      friendSurrenderNoticeMatchId: null,
      friendSurrenderNoticeRunning: false,
      friendSurrenderAckWriting: false,
      socialProfile: null,
      socialFriends: [],
      socialIncomingRequests: [],
      socialOutgoingRequests: [],
      socialIncomingRequestsError: false,
      socialOutgoingRequestsError: false,
      socialCurrentProfile: null,
      socialListenerUnsubs: [],
      socialInviteUnsubs: [],
      socialInviteToastId: null,
      socialInviteTimer: null,
      socialHandledAcceptedInvites: new Set(),
      socialInviteCreatingRooms: new Set(),
      socialInviteJoiningRooms: new Set(),
      socialInviteHandoffTimers: new Map(),
      socialInviteHandoffExpired: new Set(),
      socialInviteCleanupPending: new Set(),
      publicRooms: [],
      publicRoomFilters: {regulationId:"all",tags:[]},
      publicRoomRefreshGeneration: 0,
      publicRoomBusy: false,
      selectedPublicRoom: null,
      pendingFriendInviteTarget: null,
      roomCreateBusy: false
      ,playerCardDraft: null
      ,friendVsShownMatchIds: new Set()
    };

    const DISPLAY_SETTINGS_STORAGE_KEY = "waribashi_card_display_settings_v1";
    const NEWS_STORAGE_KEY = "waribashi_card_last_seen_news";
    const MAJOR_UPDATE_STORAGE_KEY = "waribashi_card_major_update_v156";
    const LATEST_NEWS_ID = "v167-deck-editor-peek-ui";

    const UPDATE_NEWS = [
      {id:"v167-deck-editor-peek-ui",version:"v167",date:"2026-08-28",title:"デッキ編集と「覗き見」を大幅改善",summary:"カードを探し、調整し、確認する操作がより快適になりました。",featured:true,tags:["update","ui"],items:["デッキ編集画面を大幅改善","カード名に加えて本文・種類・テーマから検索可能","種類・コスト・テーマ・採用状態・お気に入りで絞り込み可能","デッキ詳細からカード枚数を直接調整可能","お気に入り機能とお気に入り優先順を追加","設定に初期OFFのデッキ編集コンパクト表示を追加","「覗き見」の結果を最大3枚の専用確認画面で表示"]},
      {id:"v166c-interaction-modal-stability",version:"v166c",date:"2026-08-28",title:"オンライン待機とアカウント画面を安定化",summary:"相手の選択待ちとアカウント内画面の操作不具合を修正しました。",featured:true,tags:["fix","online","ui"],items:["オンラインで相手の選択待ち中に戦闘操作できてしまう問題を修正","「強制」「貿易」の最終効果を同期してから待機状態を解除するよう改善","interaction中に再接続した際の進行ロックを改善","アカウントのコード入力画面が操作不能になる問題を修正","名前変更・プレイヤーカード編集などの画面切替を改善"]},
      {id:"v166b-online-force-trade",version:"v166b",date:"2026-08-28",title:"オンラインの「強制」と「貿易」を改善",summary:"相手入力と秘密選択をオンライン対戦へ対応しました。",featured:true,tags:["fix","online"],items:["オンライン戦で「強制」の対象プレイヤー本人による選択に対応","オンライン戦で「貿易」の双方選択と同時交換に対応","SHA-256 commitと本人専用保存領域により、選択内容の先読みを防止","選択中の待機・再接続復元処理を改善"]},
      {id:"v166a-selection-late-fixes",version:"v166a",date:"2026-08-28",title:"新カードの選択操作と「遅刻」を修正",summary:"対象を自分で選べるようにし、次ターンの攻撃回数補正を安定化しました。",featured:true,tags:["fix"],items:["援護射撃・カードロック・強制・交換・貿易などの選択操作を改善","釣り合った天秤と整わないの対象選択を改善","「遅刻」の次ターン攻撃回数増加が指令補正で上書きされる問題を修正","新カードの人間操作とCPU自動選択を分離"]},
      {id:"v166-hand-attributes-new-cards",version:"v166",date:"2026-08-28",title:"新カード14枚と手札属性基盤を追加",summary:"新しい手札操作・設置・本数変化カードを追加し、特殊カードの扱いを整理しました。",featured:true,tags:["new","system"],items:["新カード14枚を追加","狙撃の加護から援護射撃を生成","共鳴×充電の振動発電を追加","強制・覗き見・交換・貿易など新しい手札操作を追加","一部システムカードを通常の手札枚数として数えない仕様へ整理","捨てられないカードを含む全捨て・ランダム捨て処理を安定化"]},
      {id:"v165n-surrender-notice-order",version:"v165n",date:"2026-08-27",title:"オンライン降参時の結果表示を改善",summary:"相手の降参を分かりやすく伝えてから勝敗画面へ進むようにしました。",featured:true,tags:["fix","system"],items:["オンラインで相手が降参した際の表示を改善","降参時は一時通知の後に勝敗画面へ進むよう変更","降参結果の表示順と端末間同期を改善","降参時に勝利理由が正しく表示されないことがある問題を修正"]},
      {id:"v165m-online-surrender-postmatch-ui",version:"v165m",date:"2026-08-27",title:"オンライン対戦の試合中・試合後UIを改善",summary:"オンライン戦の安全な操作と試合部屋へ戻る流れを整理しました。",featured:true,tags:["fix","system"],items:["オンライン戦の不要なテスト・リセット操作を整理","オンライン戦に「降参」を追加","試合後の再戦／デッキ変更／試合部屋復帰を改善","全休符のターン開始説明が旧仕様だった問題を修正"]},
      {id:"v165l-online-whole-rest-resonance-fix",version:"v165l",date:"2026-08-27",title:"ターン交代・全休符・共鳴判定を修正",summary:"一部のターン進行とカード効果の不具合を修正しました。",featured:true,tags:["fix"],items:["オンラインで一部ターン交代が失敗する問題を修正","全休符のターン進行を本来のカード使用可能回数に合わせて修正","全休符中にCPUが通常攻撃する問題を修正","全休符による通常ドロー封印の表示を修正","共鳴調節とディソナンスで0の手への共鳴が成立しない問題を修正"]},
      {id:"v165k-lobby-rules-modal-fix",version:"v165k",date:"2026-08-26",title:"オンラインロビーの同期と確認画面を修正",summary:"準備・デッキ編集・ルーム退出まわりの安定性を改善しました。",featured:true,tags:["fix"],items:["オンラインロビーの準備完了／解除が元に戻る問題を修正","ロビーからデッキ編集を開けない問題を修正","ルーム解散／退出時の権限エラーを修正","Firestore Rulesをルーム状態ごとの安全な処理経路へ整理","既存ルームの確認ポップアップがルーム作成画面の背面へ潜る問題を修正"]},
      {id:"v165j-generated-card-fix",version:"v165j",date:"2026-08-26",title:"生成・進化カードのデッキ整合性を修正",summary:"リタルダントとロマンギミック杯のデッキ制約を、本来の進化関係に合わせて修正しました。",featured:true,tags:["fix"],items:["リタルダントを生成カードとして扱い、デッキへの直接投入を禁止","ロマンギミック杯の固有禁止対象を、進化後のリタルダントから進化元のフェルマータへ修正","生成・進化カードとデッキ制約の回帰検査を追加"]},
      {id:"v165i-firestore-rules-fix",version:"v165i",date:"2026-08-26",title:"オンライン対戦の権限エラーを修正",summary:"正しいターン交代がFirestore Rulesで拒否される問題を修正しました。",featured:false,tags:["fix","system"],items:["通常のhost／guestターン交代を実Rulesと整合","Rules構文とturn lifecycle判定を修正","実Firestore Emulatorによる回帰検査を追加"]},
      {id:"v165d-v165h-online-stability",version:"v165d～v165h",date:"2026-08-25",title:"オンライン再接続とターン同期を安定化",summary:"再接続、turn claim、自動handoff、演出同期を段階的に安定化しました。",featured:false,tags:["fix","system"],items:["turn claimと開始処理の復旧を改善","ターン開始stateをatomicに確定し、二重ドローを防止","自動handoff後のFX・interrupt同期を修正"]},
      {id:"v165a-v165c-roman-online-fixes",version:"v165a～v165c",date:"2026-08-24",title:"ロマンギミック杯とオンライン開始同期を修正",summary:"特殊ルール用デッキ編集、CPU戦、オンラインの最初のターン開始を修正しました。",featured:false,tags:["fix","system"],items:["特殊ルール用デッキ編集の追加操作を修正","CPU戦で対戦ルールを選択可能に変更","オンライン対戦の開始・準備ターン同期を改善"]},
      {id:"v165-roman-gimmick",version:"v165",date:"2026-08-23",title:"特殊ルール「ロマンギミック杯」を追加",summary:"双方3ターンの準備時間でコンボを組み立てる特殊ルールを追加しました。",featured:true,tags:["new","system"],items:["準備時間中は相手への妨害を抑え、自分の準備を進められます","ルール詳細と準備ターン表示を追加","ルール別デッキ制約と対戦開始前検証を追加"]},
      {id:"v164-player-cards",version:"v164f",date:"2026-08-23",title:"プレイヤーカード機能を追加",summary:"背景と称号でプロフィールを飾り、対戦ロビーやVS画面へ表示できるようになりました。",featured:true,tags:["new","system"],items:["プレイヤーカード編集と5種類の標準背景を追加","称号・ゴールド装飾を対戦ロビーとVSカットインへ反映","コード入力とプレイヤー名変更に対応","ルーム所属時のプロフィール編集導線とエラー表示を修正"]},
      {id:"v163c-orphan-room-repair",version:"v163c",date:"2026-08-23",title:"対戦ルームの自己修復を追加",summary:"古い所属情報や孤児化した公開ルームを安全に整理する自己修復処理を追加しました。",featured:true,tags:["fix","system"],items:["起動時に古いactiveRooms所属情報を自動修復","10分以上更新のない公開ルームを、誰のactiveRoomsにも紐づかない場合だけ孤児として整理","room本体が消えた公開一覧・Room ID mappingの残骸を安全条件付きでcleanup"]},
      {id:"v163-immutable-bulletproof",version:"v163",date:"2026-08-21",title:"不変の呪縛・防弾チョッキを調整",summary:"不変の呪縛の対象手を本来の仕様へ修正し、防弾チョッキの防御対象を銃カード全般へ拡張しました。",featured:true,tags:["fix","balance"],items:["不変の呪縛は、付いている手が通常攻撃するときに加える本数への増減を無効化するよう修正","防弾チョッキは狙撃に加えて銃カードによる攻撃を防ぐよう変更","乱射でロジックアトリエを捨てた場合は従来どおり防弾チョッキを貫通"]},
      {id:"v162b-invite-lifecycle",version:"v162b",date:"2026-08-21",title:"対戦招待の同期を安定化",summary:"完了済みの対戦招待が新しい招待を妨げる場合がある問題を修正しました。",featured:false,tags:["fix","system"],items:["対戦ルームへの参加完了後に招待handoffを終了する処理を追加","古いaccepted招待が新しいpending招待を塞がないようlistenerを改善","roomReady公開時のprivate room・ルール・空席検証を強化"]},
      {id:"v162a-friend-handoff-vs",version:"v162a",date:"2026-08-21",title:"フレンド対戦の接続と開始演出を改善",summary:"対戦招待から双方が同じルームへ入る同期処理を修正し、VS演出をプレイヤーカード形式へ刷新しました。",featured:false,tags:["fix","system"],items:["招待承認後に片側だけルームへ移動する場合がある問題を修正","フレンド戦の内部Room IDをFirestore auto IDへ統一","フレンド一覧・招待表示を表示名中心に整理","VSカットインを拡張可能なプレイヤーカード形式へ変更"]},
      {id:"v162-public-rooms",version:"v162",date:"2026-08-21",title:"公開ルーム機能を追加",summary:"ルーム作成設定、公開ルーム検索、クイックマッチを追加しました。",featured:true,tags:["new","system"],items:["公開／非公開、部屋名、固定タグ、対戦ルールを選べるルーム作成設定を追加","公開ルーム一覧、ルール／タグ絞り込み、更新、クイックマッチに対応","共有用の短いRoom IDと、フレンド戦の対戦ルール指定を追加"]},
      {id:"v161b-online-connection-fixes",version:"v161b",date:"2026-08-20",title:"オンライン接続とフレンド申請を修正",summary:"受信申請の表示と対戦ルームの作成・入退室を改善しました。",featured:true,tags:["fix"],items:["フレンド申請と対戦招待の受信listenerを実Firestoreのquery Rulesへ適合","存在しないroomを事前readせず、作成成功後だけロビーへ移動するよう修正","room接続エラーとlistener timeoutを画面内へ表示し、入退室時の状態cleanupを改善"]},
      {id:"v161a-lobby-fixes",version:"v161a",date:"2026-08-20",title:"オンライン対戦ロビーを修正",summary:"ロビー表示・先攻抽選・準備状態の同期を改善しました。",featured:true,tags:["fix"],items:["PCでは自分を左、相手を右に固定し、スマートフォンでは相手を上、自分を下に表示","VS演出完了後にホストだけが先攻を1回抽選し、双方へ同期","各プレイヤーが自分の準備状態とデッキだけを更新できるようSecurity Rulesを強化"]},
      {id:"v161-persistent-lobby",version:"v161",date:"2026-08-20",title:"オンライン対戦ロビーを刷新",summary:"同じルームで準備・対戦・再戦を続けられる常設ロビーを追加しました。",featured:true,tags:["new","system"],items:["入室者名・準備状態・自分の使用デッキを確認できる専用ロビーを追加","試合終了後もルームを維持し、双方の再準備で次の試合を開始","対戦開始時のVS演出と、期限切れ・辞退後の対戦招待再送を改善"]},
      {id:"v160-social-auth",version:"v160",date:"2026-08-20",title:"アカウント・フレンド機能を改善",summary:"申請・招待の不具合修正とログイン状態保持設定を追加しました。",featured:true,tags:["system","fix"],items:["新規フレンド申請と対戦招待が権限エラーになる場合がある問題を修正","アカウント／フレンド画面の文字コントラストを改善","ログイン状態を保持する設定とAuth初期復元待機を追加"]},
      {id:"v159b-player-tags",version:"v159b",date:"2026-08-20",title:"プレイヤーIDとフレンド整合性を強化",summary:"5桁タグの一意予約とフレンド関係の原子性を改善しました。",featured:true,tags:["fix"],items:["5桁タグを全アカウントで一意に予約するplayerTags方式へ変更","プロフィールとタグ予約を同一transactionで相互検証","フレンドの双方作成・双方削除をSecurity Rulesでも同一commitに強制"]},
      {id:"v159a-social-security",version:"v159a",date:"2026-08-20",title:"アカウント・フレンド機能の安全性を改善",summary:"フレンド申請・ブロック・対戦招待の権限と期限処理を修正しました。",featured:true,tags:["fix"],items:["他プレイヤーのブロック情報をクライアントが読まない構造へ修正","フレンド申請は受信者だけが承認できるようSecurity Rulesを強化","申請・フレンド・対戦招待の表示情報偽装を防止","対戦招待の有効期限をFirestore Timestampへ統一"]},
      {id:"v159-account-friends",version:"v159",date:"2026-08-20",title:"アカウント・フレンド機能を追加",summary:"Google／メールアカウント、プレイヤーID検索、フレンド申請、対戦招待を追加しました。",featured:true,tags:["new","system"],items:["匿名のまま遊べる従来仕様を維持し、Googleまたはメールでデータを引き継いだアカウントを作成可能","プレイヤー名と5桁タグからなる公開IDでフレンドを検索","フレンド申請・承認・拒否・解除・ブロックに対応","フレンドへ60秒間有効な対戦招待を送り、承認後は既存のオンライン対戦へ自動接続"]},
      {id:"v158b-dance-canon",version:"v158b",date:"2026-08-19",title:"乱舞とカノンの攻撃処理を整理",summary:"乱舞を置換攻撃として通常攻撃から分離し、カノンを通常攻撃の遅延出力として簡略化しました。",featured:true,tags:["fix"],items:["乱舞は攻撃行動を消費する置換攻撃となり、通常攻撃履歴・通常攻撃限定効果には含まれないよう変更","乱舞でも対象変更・攻撃無効・攻撃後反応の罠は有効、ぬかるみ等の本数補正は不成立","カノン攻撃でも罠・不変・守護等を通常どおり処理し、最終対象と本来加える本数を保存","カノンのその場の加算は0、遅延出力時に対象が0なら不発"]},
      {id:"v158a-dance-after-traps",version:"v158a",date:"2026-08-19",title:"乱舞の罠処理を修正",summary:"乱舞の攻撃後罠を共通処理へ統合しました。",featured:true,tags:["fix"],items:["乱舞で囮・茨・反撃・スワンプマンなどの攻撃後罠を処理","1攻撃1罠を維持し、ぬかるみは乱舞では発動・消費しない","攻撃置換で本数補正が適用されない場合のログ表示を修正"]},
      {id:"v158-normal-attack-wording",version:"v158",date:"2026-08-19",title:"通常攻撃ルールとカード本文を整理",summary:"「攻撃」と「通常攻撃」の表記、一部カードの対象条件、成長と乱舞の処理を調整しました。",featured:true,tags:["update","fix"],items:["通常攻撃は発生経路を問わず同じルールで扱い、自分の手への通常攻撃にも対応","カード本文の攻撃力表記を、加える本数・受ける本数が分かる表現へ整理","成長を、攻撃対象が5になった瞬間に5→0より先に1枚引く効果へ変更","独善・みんなのための正義・悪党の印などの通常攻撃対象条件を整理","乱舞を攻撃結果置換として明確化し、ぬかるみが発動・消費されないよう変更"]},
      {id:"v157-attack-trap-core",version:"v157",date:"2026-08-19",title:"攻撃・罠の共通仕様を整理",summary:"通常攻撃力、不変の呪縛、攻撃置換、乱射と罠の相互作用を統一しました。",featured:true,tags:["update","fix"],items:["攻撃を通常攻撃とカード攻撃に分類し、乱射を罠対応カード攻撃として整理","通常攻撃力を素の攻撃力・攻撃力補正・最終攻撃力・受ける本数に分離","不変の呪縛は正負すべての攻撃力補正を無効化し、防御側の軽減には干渉しない仕様へ変更","乱舞・ゴールドラッシュなどの攻撃置換へ攻撃力補正を加えないよう統一","1回の攻撃につき罠1枚、手動罠優先、手動不使用時のみ自動罠という共通仕様を明文化","指令：連撃失敗の攻撃回数減少が次の自分ターンだけで消費されるよう同期処理を修正"]},
      {id:"v156-harpoon-theme",version:"v156",date:"2026-08-18",title:"新テーマ「黄針が刻む振動の果て」",summary:"銛を打ち込み、攻撃で振動を育てて回収する新テーマを追加しました。",featured:true,tags:["new","update","fix"],items:["新カード9枚と生成カード「銛」を追加","銛付きの手へ通常攻撃を命中させると「銛-振動」が増加","そのターン最初の命中時に攻撃したプレイヤーが1枚ドロー","銛を回収すると蓄積した振動を現在の付着先へ一気に加算","移動しても振動を保持し、解呪など回収以外の除去では振動は発動しない","「銛を埋める」を次の通常攻撃直前、対象変更後の最終対象へ付与するよう強化","friend戦で銛の所有者が反転する問題を修正し、回収演出を強化"]},
      {id:"v155-directive-deus-vult",version:"v155",date:"2026-08-12",title:"指令テーマを大幅強化",summary:"新指令と指令テーマの終着点を追加しました。",featured:true,tags:["new","update"],items:["新しい指令「殲滅」「連撃」「定数」を追加","既存指令の達成・未達成効果を調整","「再解釈」「当然の信心」「神意の証明」を追加","指令を達成し続けることで「DEUS VULT」へ到達可能","DEUS VULTの宣告終了後に盤面へ戻ってhitが進むよう演出と速度を改善","攻撃回数も使用可能カードもないターンを、カード解決後にも自動終了","リタルダントで相手の手を0まで減らせるよう変更","すべての指令カードのコストを1に統一","カード使用禁止の原因表示と未使用輪舞曲マークを追加","カノンで記録する通常攻撃では罠を一切発動・消費せず、罠以外の補正を攻撃時に確定して最終加算量を記録するよう調整","カノンが特殊な本数処理下で盤面差分をamountとして記録する問題を修正","カノン記録時に実際の盤面が変化していないのに身構え・E=mc²等が発動または消費される問題を修正","カノンと雷撃を組み合わせた際、雷撃の一部効果だけが次の攻撃へ持ち越される問題を修正","ダブルダブルの追加行動で2回目の攻撃ができず、乱闘経由で進行不能になる場合がある問題を修正","指令累計CLEAR表示と再戦時リセットを修正","ラクリモーサが本文どおり終端にならない問題を修正","指令関連のオンライン同期・UIを改善"]},
      {id:"v154-restriction-friendfx-glow",version:"v154",date:"2026-08-11",title:"ターン通知・オンライン演出を改善",summary:"行動制約の通知とfriend戦の専用演出を改善しました。",featured:true,tags:["update","fix"],items:["乱闘で題目設定が発動するよう変更","予告状では題目設定を引き続き除外","Appassionatoに次ターンのカード使用不可を追加","ターン開始時の行動制約通知を改善","friend戦で魔法少女の詠唱演出が相手に見えない問題を修正","演舞による強化カードを水色発光で表示"]},
      {id:"v153-selection-ui",version:"v153",date:"2026-08-11",title:"選択UIを改善",summary:"カード効果の選択操作をゲーム内UIへ統一しました。",featured:true,tags:["update","ui"],items:["カードの手対象選択を盤面クリックへ統一","題目設定・変調などの選択画面をゲーム内カードパネルへ変更","フェルマータなどの確認画面をゲーム内UIへ変更","満ちる心の手札選択とアルペジオの本数配分を改善","ゲーム進行中のブラウザ標準ダイアログを撤去"]},
      {id:"v152-rondo-bullets-internal-attack",version:"v152",date:"2026-08-10",title:"輪舞曲・弾丸カード調整",summary:"輪舞曲と弾丸カードを調整し、内部通常攻撃の共通基盤を拡張しました。",featured:true,tags:["new","update"],items:["回収弾の回収先を山札へ変更","不発弾のコストを0へ変更し、減装弾の対象条件を調整","Lacrimosaに終端を追加","新輪舞曲「ポルタメント」「プレスト」を追加","演舞Ⅴ以上の強化形「ディソナンス」「スフォルツァント」を追加","凶弾と新カードで利用する内部通常攻撃処理を共通化"]},
      {id:"v151-performance-rondo-rebalance",version:"v151",date:"2026-08-10",title:"題目・演舞システム再調整",summary:"題目・演舞・輪舞曲を再調整し、全休符の使用可能判定を修正しました。",featured:true,tags:["update","fix"],items:["演舞の最大値をⅥへ変更し、Ⅴ以上で強化を維持","題目：ロンドの初使用ボーナスを+2へ変更し、変化前後を別履歴化","題目設定使用後にもう1枚カードを使用可能","リタルダントを次の相手ターン中の全ドロー禁止へ強化","Lacrimosa・Requiemの使用可能ターンとAndanteのコストを調整","全休符が設置カードを使用不能と誤判定する問題を修正"]},
      {id:"v150-starting-player-roulette",version:"v150",date:"2026-08-10",title:"対戦開始演出・フレンド戦表示を改善",summary:"先攻ルーレットとフレンド戦のホスト／ゲスト表示を追加しました。",featured:true,tags:["new","update"],items:["試合開始時に先攻ルーレットを追加","CPU戦の先攻をランダム化","friend戦でも先攻を同期してランダム決定","friend戦のプレイヤー表示をホスト／ゲストへ改善","ログやターン表示のCPU表記を整理"]},
      {id:"v149-rondo-expansion",version:"v149",date:"2026-08-10",title:"輪舞曲をさらに拡張",summary:"新しい輪舞曲系列と演舞Lv.Ⅴの強化カードを追加しました。",featured:true,tags:["new","update"],items:["Agitato・Doloroso・Lacrimosaを追加","演舞Lv.ⅤでFurioso・Appassionato・Requiemへ強化","Morendo・Grandiosoを追加","Furiosoの連続攻撃を追加","Appassionatoの追加カード使用とRequiemの手札全破棄を追加"]},
      {id:"v148-resonance-theme-expansion",version:"v148",date:"2026-08-10",title:"共鳴テーマを大幅拡張",summary:"題目・演舞・輪舞曲システムと共鳴関連カードを追加しました。",featured:true,tags:["new","system"],items:["題目と演舞レベルシステムを追加","輪舞曲とフェルマータ・カノン・4分休符を追加","演舞Lv.Ⅴでリタルダント・アルペジオ・全休符へ強化","アンコール・ダ・カーポを追加","v147銃カードへ守護軽減が適用されるよう修正"]},
      {
        id: "v147-gun-bullet-expansion",
        version: "v147",
        date: "2026-08-09",
        title: "銃・弾テーマを大幅拡張",
        summary: "「銃」カテゴリを新設し、新しい銃4枚・弾6枚と弾の連鎖処理を追加しました。",
        featured: false,
        tags: ["new", "system"],
        items: [
          "「銃」カテゴリを追加し、乱射・凶弾を銃として扱うよう変更",
          "再装填の対象を乱射から銃カード全般へ拡張",
          "無差別射撃・ショットガン・変調・ファニングを追加",
          "回収弾・減装弾・曳光弾・不発弾・阻害弾・粉砕弾を追加",
          "弾テーマの捨て札時効果と連鎖処理を整理"
        ]
      },
      {
        id: "v146-news-update",
        version: "v146",
        date: "2026-08-08",
        title: "お知らせを更新",
        summary: "終了した大会告知を削除し、最近のアップデート情報とNEW表示を更新しました。ゲーム内容の変更はありません。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "大会開催予告を終了したため、大会告知を削除",
          "v142からv145までのアップデート情報をお知らせへ追加",
          "お知らせのNEW表示を最新版に更新",
          "ゲーム内容の変更はありません"
        ]
      },
      {
        id: "v145-update",
        version: "v145",
        date: "2026-08-08",
        title: "捨て札・凶弾まわりを大幅整理",
        summary: "捨て札時効果・乱射・凶弾の処理を統一し、通常攻撃関連の効果が正しく適用されるよう整理しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "カード効果で手札から捨てられた場合、疲労を除いて「捨てられた時」の効果が発動するよう処理を統一",
          "空虚・傾いた天秤・最終判決：没収・貪欲・憎悪・幸福などのランダム手札破棄にも対応",
          "疲労による手札破棄では、これまで通り捨て札時効果は発動しない仕様を維持",
          "乱射のコストとして手札に残る別の乱射も捨てられるよう修正し、乱闘時はコピー元の1枚だけを除外",
          "凶弾による攻撃を通常攻撃として扱い、攻撃力増減・加護・呪縛・防御効果などを適用",
          "凶弾は通常攻撃として処理される一方、空間切断・友情などの攻撃回数は消費しない仕様を維持",
          "凶弾の仕様変更に合わせて一部カードテキストを整理"
        ]
      },
      {
        id: "v144-update",
        version: "v144",
        date: "2026-08-08",
        title: "乱闘・予告状の安全性を改善",
        summary: "乱闘・予告状の安全性と、一部カードの発動条件や表記を改善しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "乱闘では通常の使用条件を無視しても、効果内の不発条件・対象・消費・代償を通常通り判定",
          "予告状は予約時に通常の使用条件を確認し、次ターンの発動時には効果内条件を判定する仕様へ整理",
          "対象のない解除・看破・手繰り寄せ・すりかえ・解呪などを特殊発動しても操作不能にならないよう修正",
          "最終判決3種・等価なる断罪などの成立条件を効果発動時にも正しく判定",
          "予告状で弾を捨てた際、「カード効果で捨てられた時」の効果も発動するよう修正",
          "調律を特殊発動した際のCPUとプレイヤーの挙動差を修正",
          "アンダンテ使用時に予告状・光速回路・充電・指令など無関係な状態が初期化される不具合を修正",
          "友情の追加攻撃中に「空間切断」と表示される問題を修正",
          "一部カードの「攻撃」表記を「通常攻撃」へ整理"
        ]
      },
      {
        id: "v143-update",
        version: "v143",
        date: "2026-08-08",
        title: "複数回攻撃の処理を統一",
        summary: "空間切断や友情など、複数回攻撃の処理を安定化しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "空間切断や友情など、複数回攻撃の攻撃回数処理を統一",
          "通常命中・空振り・ねこだまし・乱舞・攻撃力0・対象消失など、結果に関係なく攻撃回数を正しく消費するよう修正",
          "追加攻撃の終了判定を共通化",
          "フレンド対戦で1発目の結果を2発目前に同期する処理を整理",
          "乱舞・ゴールドラッシュなどの攻撃置換は攻撃回数を消費する一方、攻撃力上昇ではないため不変の呪縛の対象外となるよう整理",
          "ゴールドラッシュの基本攻撃力置換が不変の呪縛で抑制される問題を修正"
        ]
      },
      {
        id: "v142-update",
        version: "v142",
        date: "2026-08-08",
        title: "空間切断の追加攻撃を修正",
        summary: "複数回攻撃が無効になった場合の攻撃回数処理を修正しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "空間切断の2発目が空振りで無効化された際、さらに3発目を行えてしまう不具合を修正",
          "無効化された攻撃も攻撃回数として正しく消費するよう変更",
          "フレンド対戦で追加攻撃途中の状態が正しく同期されるよう調整"
        ]
      },
      {
        id: "v140-charge-bugfixes",
        version: "v140",
        date: "2026-08-08",
        title: "充電テーマの進行不能・状態持越しを修正",
        summary: "空間切断・予告状＋過充電・廉価バッテリー・疲労で確認された充電関連の不具合をまとめて修正しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "充電Lv.5～9で空間切断の代償を選ぶと処理が停止する不具合を修正",
          "予告状で過充電を予約した場合、発動したターンではなく次の自分ターンに反動が発生するよう修正",
          "廉価バッテリーの劣化回数がゲームリセット後も残る不具合を修正",
          "疲労では充電を捨てず、充電しかない場合は手札0枚として手の本数を1減らす仕様に修正",
          "充電は通常のランダム手札破棄でも保護されるよう処理を統一"
        ]
      },
      {
        id: "v137-judgment-theme-release",
        version: "v137",
        date: "2026-07-25",
        title: "新テーマ「傾かぬ天秤に判決を」",
        summary: "両手の均衡を整え、互いの重さを量り、条件を満たして最終判決を下す法廷・天秤テーマを正式実装しました。",
        featured: true,
        tags: ["new", "system"],
        items: [
          "新テーマ「傾かぬ天秤に判決を」を正式実装",
          "両手の本数が等しい『均衡』状態を利用する、均衡の刃・均衡の恩恵・天秤の加護を追加",
          "調律・平等な世界で盤面をそろえ、不平等な世界・天罰で均衡を崩す二つの戦術を追加",
          "等価なる断罪と傾いた天秤により、均衡状態や両者の合計本数を直接勝負へ結びつけるカードを追加",
          "条件を満たした2度目の自分のターン以降に使用できる、没収・死刑・懲役の3種類の最終判決を追加",
          "死刑から得られる生成カード『執行』で、相手の本数が多い手を0にする処刑ルートを追加",
          "相手の終端カードを差し戻す『控訴』と、山札へ戻す『上告』の手札割り込みシステムを追加",
          "控訴・上告されたカードは効果と終端が無効になり、使用権は返るが同名カードはそのターン使用不可",
          "最終判決にはガベル、執行には裁きの紋章、傾いた天秤には合計本数を量る専用演出を追加",
          "CPU戦・フレンド対戦の条件判定、割り込み、状態変化、演出同期に対応"
        ]
      },
      {
        id: "v131-card-use-lock-fix",
        version: "v131",
        date: "2026-07-24",
        title: "カードが反応しなくなる問題を修正",
        summary: "設置系カードの選択時に処理が停止する不具合と、オンラインでカード使用済み状態が残る可能性を修正しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "罠・加護・呪縛を選んだ際の未定義変数エラーを修正",
          "控訴・上告の同名使用禁止を設置系カードにも正しく適用",
          "オンラインで古い同期状態が自分のカード使用権を上書きしないよう改善",
          "ダブルダブルは追加の攻撃・分けるだけを付与し、カード使用権には影響しないことを確認"
        ]
      },
      {
        id: "v125-fatigue-rule-rework",
        version: "v125",
        date: "2026-07-20",
        title: "山札切れ時の「疲労」を改正",
        summary: "山札が0枚の状態でカードを引こうとするたび、手札または手の本数を失う明確な疲労ルールへ変更しました。",
        featured: false,
        tags: ["balance", "system"],
        items: [
          "山札0枚でドローを試みるたびに疲労を1回適用",
          "手札がある場合はランダムに1枚捨てる",
          "手札がない場合は生存している手をランダムに1本減らす",
          "複数ドローではドロー回数分だけ疲労を繰り返す",
          "疲労発生時の専用ポップアップとオンライン同期を追加"
        ]
      },
      {
        id: "v124-online-hand-final-hit-sync",
        version: "v124",
        date: "2026-07-19",
        title: "オンラインの手の変化とトドメ同期を改善",
        summary: "整えるなどで手の本数を直接変更した結果と、勝敗を決める最後の攻撃を相手側へ確実に反映するよう修正しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "整える・補修・アンダンテ・等価交換などの確定結果を即時同期",
          "愛で！・裏切られた心など、手の本数を直接変更する選択式カードも即時同期",
          "通常攻撃と狙撃の計算結果を専用演出イベントとして相手側へ送信",
          "トドメの盤面と攻撃結果を勝敗通知より先に同期",
          "相手側でも何の攻撃で倒されたか確認してからリザルトへ進行"
        ]
      },
      {
        id: "v123-online-trap-zero-fix",
        version: "v123",
        date: "2026-07-19",
        title: "オンラインの手動罠と0化処理を修正",
        summary: "手動罠を発動しない選択後に進行できない場合がある問題と、狙撃・捨て身で手が0になった際の勝敗・同期処理を改善しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "手動罠を発動しない選択を明示的なスキップ応答として同期",
          "解決済みのオンライン割り込み情報を処理後に消去",
          "手動罠の確認通信に失敗しても不発扱いで試合を続行",
          "狙撃で最後の手が0になった直後に勝敗を判定・同期",
          "捨て身の反動で両手が0になった直後に勝敗を判定"
        ]
      },
      {
        id: "v122-berserker-buff",
        version: "v122",
        date: "2026-07-19",
        title: "バーサーカーを強化",
        summary: "攻撃にすべてを委ねるバーサーカーへ、7以上の対象をそのまま0にする新効果を追加しました。",
        featured: false,
        tags: ["balance"],
        items: [
          "バーサーカーの効果期間中、攻撃で対象の手が7以上になった場合は超過処理をせず0に変更",
          "対象変更が発生した場合は、変更後の最終対象で7以上かを判定",
          "効果期間中の複数回攻撃にも毎回適用",
          "CPUが新しい即0条件を考慮して攻撃対象を選ぶよう調整",
          "スターターデッキ更新などv121までの内容を維持"
        ]
      },
      {
        id: "v120-love-and-hatred-theme-release",
        version: "v120",
        date: "2026-07-19",
        title: "新テーマ「愛と憎しみの名の下に」",
        summary: "光と影のはざまで感情を抱えたまま戦い、四つの心をそろえてカードそのものを変化させる魔法少女テーマを正式実装しました。",
        featured: false,
        tags: ["new", "system"],
        items: [
          "新テーマ「愛と憎しみの名の下に」を正式実装",
          "虚無によって4種類の加護と9種類の感情変化カードが変身後の姿へ変化",
          "憎悪・絶望・貪欲・憤怒を、愛・正義・幸福・勇気へ変える変身システムを追加",
          "共有詠唱を3段階進めて解禁する終端技『アルカナ・スレイブ！！』を追加",
          "詠唱・変身・アルカナ・スレイブに全画面専用演出を追加",
          "すり減る希望、ヒステリー、犠牲の力などに専用カード選択UIを追加",
          "狂乱、独善、悪党の印、涙で研ぎ澄まされた剣、ゴールドラッシュ、空虚など新しい攻撃・妨害戦術を追加",
          "CPU戦とフレンド対戦の進捗・変身・演出・ランダム結果を同期"
        ]
      },
      {
        id: "v97-dimensional-slash-self-sacrifice-fix",
        version: "v97",
        date: "2026-07-17",
        title: "空間切断の自傷処理を修正",
        summary: "充電5～9で発動する空間切断の代償処理と、オンラインへの反映を修正しました。",
        featured: false,
        tags: ["fix", "balance"],
        items: [
          "選択した自分の手を代償として確実に0へ変更",
          "0になった手の罠・加護・呪縛を正しく消去",
          "最後の手を代償にした場合はその場で敗北",
          "敗北した場合は攻撃+1と2回攻撃を付与しない",
          "自傷結果を攻撃選択前にオンライン相手へ明示同期",
          "手を選ぶ前に案内文が上書きされる問題を修正"
        ]
      },
      {
        id: "v96-tutorial-explanation-ok-trap-fix",
        version: "v96",
        date: "2026-07-17",
        title: "空振りの進行と説明確認を改善",
        summary: "空振り発動後に進まない問題を修正し、分ける・加護・呪縛の説明をOKボタンで確認するステップを追加しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "空振りの効果処理完了後に茨の課題へ進行",
          "説明専用ステップにOKボタンを追加",
          "分けたターンは攻撃できないことを改めて説明",
          "分ける前後で合計本数は変わらないことを説明",
          "分けた結果として片方を0にできないことを説明",
          "罠・加護・呪縛の設置先、公開状態、継続性を文章でも説明",
          "付いている手が0になると設置カードも消えることを説明"
        ]
      },
      {
        id: "v95-tutorial-attachment-board-fix",
        version: "v95",
        date: "2026-07-17",
        title: "設置カード進行と課題盤面を修正",
        summary: "罠・加護・呪縛で手の選択へ進めない問題、強打後に軽打用の相手が消える問題、章選択文字のはみ出しを修正しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "設置カードを選んだ時点で、設置する手を選ぶ段階へ移行",
          "実際に設置した後で次の課題へ進行",
          "強打の攻撃演出完了後に軽打用の3・0対3・0を再構築",
          "軽打完了後も終端カード用の1・1対1・1を再構築",
          "章選択カードの文字折り返しとスマートフォン表示を改善"
        ]
      },
      {
        id: "v94-tutorial-action-lock-fix",
        version: "v94",
        date: "2026-07-17",
        title: "チュートリアルの操作制限と進行を修正",
        summary: "意図しない攻撃、分ける章での攻撃、ひらめき使用後に進まない問題を修正しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "第1章を自分1・1／相手1・1から始まる指定進行へ変更",
          "右手で相手左を攻撃後、練習CPUが左手で自分右を攻撃",
          "自分1・3／相手2・1から右手で相手左を5にして0化",
          "指定された手以外と、手を使わない課題中の全手入力を無効化",
          "分ける章では攻撃を完全に禁止",
          "ひらめきなど通常カードの効果解決後に章を進めるよう修正",
          "罠・加護・呪縛は実際に設置完了した後で進行"
        ]
      },
      {
        id: "v93-isolated-tutorial-battle",
        version: "v93",
        date: "2026-07-17",
        title: "チュートリアル対戦を通常CPU戦から分離",
        summary: "通常対戦と同じ見た目・操作を保ちつつ、CPU思考や通常ターン進行が入り込まない専用対戦セッションへ変更しました。",
        featured: false,
        tags: ["fix", "system"],
        items: [
          "チュートリアル専用の試合状態を追加",
          "通常のCPU思考・カード選択・追加行動を完全停止",
          "ターン終了後にCPUへ自動で渡る処理を停止",
          "通常の勝敗画面とゲーム終了処理を停止",
          "罠の説明で必要なCPU攻撃だけを台本から実行",
          "章終了・通常対戦開始時にチュートリアル状態を確実に解除"
        ]
      },
      {
        id: "v92-tutorial-real-battle-ui",
        version: "v92",
        date: "2026-07-17",
        title: "チュートリアルを通常対戦画面へ統合",
        summary: "専用の簡易盤面を廃止し、CPU戦と同じ盤面・手札・演出・分ける・設置UIで学べるように作り直しました。",
        featured: false,
        tags: ["system", "fix"],
        items: [
          "章選択後は通常のCPU戦画面をそのまま使用",
          "実際の攻撃選択と計算演出で基本攻撃を練習",
          "通常の分ける欄と決定ボタンを使用",
          "実際の手札カードUIからひらめき・強打・軽打・終端を使用",
          "通常の罠設置と手動罠確認、自動罠処理を使用",
          "通常の加護・呪縛設置UIを使用",
          "チュートリアルは固定盤面と操作誘導のみ担当"
        ]
      },
      {
        id: "v91-tutorial-screen-fix",
        version: "v91",
        date: "2026-07-17",
        title: "チュートリアル画面が開かない問題を修正",
        summary: "ホームや初回案内からチュートリアルを開始しても画面が表示されない問題を修正しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "画面切り替え処理へチュートリアル画面を正式に追加",
          "ホームのチュートリアルボタンから章一覧を表示",
          "初回案内の『チュートリアルを始める』から正常に開始",
          "第1章の5で0・超過計算を、攻撃手と対象手を選ぶ2段階操作へ修正"
        ]
      },
      {
        id: "v90-beginner-tutorial",
        version: "v90",
        date: "2026-07-17",
        title: "全5章の初心者チュートリアルを追加",
        summary: "新規プレイヤー向けに、基本攻撃から加護・呪縛まで実際に操作して学べるチュートリアルを追加しました。",
        featured: false,
        tags: ["system"],
        items: [
          "第1章「攻撃を使おう」：攻撃、5で0、超過計算",
          "第2章「分けるを使おう」：2・0を1・1に分けて敗北回避",
          "第3章「カードの使い方」：ひらめき、強打、軽打、終端",
          "第4章「罠を使おう」：空振りの手動発動と茨の自動発動",
          "第5章「加護と呪縛」：力の加護と鈍重の呪縛",
          "初回案内を大型アップデート告知より先に表示",
          "章クリア状況と続きからの位置をブラウザに保存"
        ]
      },
      {
        id: "v89-dimensional-slash-mid-sync",
        version: "v89",
        date: "2026-07-17",
        title: "空間切断のオンライン途中同期を修正",
        summary: "空間切断の1回目と2回目の攻撃結果が、相手側でまとめて反映される問題を修正しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "1回目の攻撃解決直後に盤面を明示的に同期",
          "相手側で1回目の演出後すぐに本数が更新されるよう変更",
          "1回目の同期完了後に2回目の攻撃選択へ進行",
          "通常攻撃やCPU戦の進行には影響しない"
        ]
      },
      {
        id: "v88-deck-editor-upgrade",
        version: "v88",
        date: "2026-07-16",
        title: "デッキ編集画面を大幅改善",
        summary: "増えたカードを探しやすくする並び替え・検索機能と、現在のデッキ内容を確認する詳細画面を追加しました。",
        featured: false,
        tags: ["system"],
        items: [
          "実装順・名前順・コスト順・種類順の並び替えを追加",
          "カード名だけを対象にする名前検索を追加",
          "効果文・種類・属性を対象にするキーワード検索を追加",
          "生成カードは並び替え後も一覧の最後に表示",
          "画面下部にデッキの「詳細」ボタンを追加",
          "カード種類別の枚数・カード一覧・投入枚数・コストを表示"
        ]
      },
      {
        id: "v87-compact-card-descriptions",
        version: "v87",
        date: "2026-07-16",
        title: "手札のコンパクト表示設定を追加",
        summary: "手札が増えた時にカード説明を省略し、長押しで効果を確認できる表示設定を追加しました。",
        featured: false,
        tags: ["system"],
        items: [
          "設定に「カード説明を省略する」を追加",
          "設定ON時は手札カードを名前中心にコンパクト表示",
          "カードを約0.55秒長押しすると効果・コスト・種類を表示",
          "長押し直後にカードを誤使用しないクリック抑止を追加",
          "設定はブラウザに保存され、初期状態はOFF"
        ]
      },
      {
        id: "v86-legacy-card-buffs",
        version: "v86",
        date: "2026-07-16",
        title: "旧カード6種を強化",
        summary: "初期から存在するカードを、現在の環境に合わせて強化・刷新しました。",
        featured: false,
        tags: ["balance", "system"],
        items: [
          "強打のコストを2から1へ変更",
          "過加速をコスト2、追加ドロー3ターンへ強化",
          "補修の終端効果を削除",
          "探りを山札の一番上を確認する効果へ刷新",
          "倹約令のコストを3から2へ変更",
          "反撃のコストを3から2へ変更"
        ]
      },
      {
        id: "v85-charge-theme-release",
        version: "v85",
        date: "2026-07-16",
        title: "新テーマ「光速に灼かれた紫電」",
        summary: "充電を蓄え、消費し、限界を越えて加速する新テーマを追加しました。",
        featured: true,
        tags: ["new", "system"],
        items: [
          "充電テーマの新カード12種類を追加",
          "光速回路に紫電のOVERCLOCK演出を追加",
          "廉価バッテリーの劣化ポップアップを追加",
          "E=mc²による敗北回避を追加",
          "発電・直接攻撃・防御・充電消費の新しい戦術を追加"
        ]
      },
      {
        id: "v83-online-circuit-fix",
        version: "v83",
        date: "2026-07-16",
        title: "光速回路のオンライン同期を修正",
        summary: "光速回路の一試合一度状態を、プレイヤーごとの所有状態として管理するよう変更しました。",
        featured: false,
        tags: ["fix"],
        items: [
          "hostとguestの光速回路使用済み状態を分離",
          "相手側の古い状態で上書きされる競合を修正",
          "反動予約と充電カード使用済み状態も所有者管理へ変更"
        ]
      },
      {
        id: "v82-charge-once-rule",
        version: "v82",
        date: "2026-07-16",
        title: "充電カードの使用制限を整理",
        summary: "同名の充電カードは1ターンに1度まで使用できるようになりました。",
        featured: false,
        tags: ["balance", "fix"],
        items: [
          "光速回路中でも同名充電カードの重ね掛けを防止",
          "乱闘は効果コピーのため使用制限の対象外",
          "予告状は公開したターンに使用済みとして判定"
        ]
      },
      {
        id: "v80-overclock",
        version: "v80",
        date: "2026-07-16",
        title: "光速回路専用演出「OVERCLOCK」",
        summary: "光速回路の正常発動時に、紫の電撃を用いた専用演出を追加しました。",
        featured: false,
        tags: ["system"],
        items: [
          "オンライン対戦でも両者へ演出を同期",
          "紫電・画面振動・明滅を中心とした演出へ調整"
        ]
      }
    ];

    function newsTagLabel(tag) {
      return {
        new: "NEW CARD",
        balance: "BALANCE",
        fix: "FIX",
        system: "SYSTEM",
        event: "EVENT"
      }[tag] || String(tag || "").toUpperCase();
    }

    const displaySettings = { compactCardDescriptions: false, deckCompactMode: false };
    const DECK_FAVORITES_STORAGE_KEY = "waribashi_card_deck_favorites_v1";
    const deckFavorites = new Set();

    function loadDisplaySettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY) || "{}");
        displaySettings.compactCardDescriptions = saved.compactCardDescriptions === true;
        displaySettings.deckCompactMode = saved.deckCompactMode === true;
      } catch {
        displaySettings.compactCardDescriptions = false;
        displaySettings.deckCompactMode = false;
      }
      try {
        const savedFavorites = JSON.parse(localStorage.getItem(DECK_FAVORITES_STORAGE_KEY) || "[]");
        if (Array.isArray(savedFavorites)) savedFavorites.forEach(id => { if (CARD_LIBRARY[id]) deckFavorites.add(id); });
      } catch {}
    }

    function saveDisplaySettings() {
      try {
        localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(displaySettings));
      } catch {}
    }

    function saveDeckFavorites() {
      try { localStorage.setItem(DECK_FAVORITES_STORAGE_KEY, JSON.stringify([...deckFavorites])); } catch {}
    }

    const TUTORIAL_STORAGE_KEY = "waribashi_card_tutorial_progress_v1";
    const TUTORIAL_WELCOME_KEY = "waribashi_card_tutorial_welcome_v1";

    const TUTORIAL_CHAPTERS = [
      { id: 1, title: "攻撃を使おう", subtitle: "手を選んで攻撃し、5と超過計算を覚えます。" },
      { id: 2, title: "分けるを使おう", subtitle: "2・0を1・1に分けて、敗北を回避します。" },
      { id: 3, title: "カードの使い方", subtitle: "ひらめき、強打、軽打、終端カードを体験します。" },
      { id: 4, title: "罠を使おう", subtitle: "空振りの手動発動と、茨の自動発動を体験します。" },
      { id: 5, title: "加護と呪縛", subtitle: "力の加護と鈍重の呪縛を設置して違いを学びます。" }
    ];

    const TUTORIAL_CARD_INFO = {
      inspiration: { name: "ひらめき", type: "補助", text: "カードを1枚引く。" },
      strongHit: { name: "強打", type: "攻撃補助", text: "このターン、次の通常攻撃で加える本数+1。" },
      lightHit: { name: "軽打", type: "攻撃補助", text: "このターン、次の通常攻撃で加える本数-1。" },
      pass: { name: "パス", type: "終端", text: "このカードを使うと、ただちにターンを終了する。" },
      miss: { name: "空振り", type: "罠・手動", text: "攻撃された時、発動するか選び、その攻撃を無効にする。" },
      thorns: { name: "茨", type: "罠・自動", text: "攻撃された時に自動発動し、攻撃した相手の手に＋1する。" },
      powerBlessing: { name: "力の加護", type: "加護", text: "この手の通常攻撃で加える本数+1。発動後も場に残る。" },
      sluggishCurse: { name: "鈍重の呪縛", type: "呪縛", text: "この手の通常攻撃で加える本数-1。相手の手に付ける。" }
    };

    let tutorial = {
      chapter: 0,
      step: 0,
      selectedAttackHand: null,
      chapterComplete: false,
      usingRealBattle: false,
      expected: null,
      cardUsed: null
    };

    function loadTutorialProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) || "{}");
        return {
          completed: Array.isArray(saved.completed) ? saved.completed : [],
          lastChapter: Number(saved.lastChapter) || 1
        };
      } catch {
        return { completed: [], lastChapter: 1 };
      }
    }

    function saveTutorialProgress(chapter, complete = false) {
      const progress = loadTutorialProgress();
      progress.lastChapter = chapter;
      if (complete && !progress.completed.includes(chapter)) progress.completed.push(chapter);
      try { localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(progress)); } catch {}
    }

    const handNames = {
      L: "左手",
      R: "右手",
      human: "あなた",
      cpu: "CPU"
    };

    function getPlayerDisplayName(player,{includeYou=false,turnLabel=false}={}){
      if(state.battleMode!=="friend")return player==="human"?"あなた":"CPU";
      const role=player==="human"?state.friendRole:otherFriendRole();
      const label=roomMember(state.friendRoomData,role)?.displayName||(player==="human"?"あなた":"相手");
      if(player==="human"&&turnLabel)return "あなた";
      return includeYou&&player==="human"?`${label}（あなた）`:label;
    }

    function refreshPlayerDisplayNames(){
      handNames.human=state.battleMode==="friend"?getPlayerDisplayName("human"):"あなた";
      handNames.cpu=getPlayerDisplayName("cpu");
      if(elements?.humanPlayerName)elements.humanPlayerName.textContent=getPlayerDisplayName("human",{includeYou:true});
      if(elements?.cpuPlayerName)elements.cpuPlayerName.textContent=getPlayerDisplayName("cpu",{includeYou:true});
    }

    function chooseStartingPlayer(){return Math.random()<0.5?"human":"cpu";}
    function chooseFriendStartingRole(){return Math.random()<0.5?"host":"guest";}
    function decideFriendStartingPlayer(existingStartingPlayer=null){
      return existingStartingPlayer==="host"||existingStartingPlayer==="guest"
        ? existingStartingPlayer
        : chooseFriendStartingRole();
    }
    function localPlayerForStartingPlayer(startingPlayer){
      if(state.battleMode!=="friend")return startingPlayer;
      return startingPlayer===state.friendRole?"human":"cpu";
    }
    function startingPlayerDisplayName(startingPlayer){
      if(state.battleMode!=="friend")return startingPlayer==="human"?"あなた":"CPU";
      return roomMember(state.friendRoomData,startingPlayer)?.displayName||"プレイヤー";
    }

    async function playStartingRoulette(startingPlayer,{duration=1600,hold=650}={}){
      const overlay=elements.startingPlayerRoulette,wheel=elements.startingRouletteWheel;
      if(!overlay||!wheel)return;
      state.startingRouletteActive=true;render();
      const labels=state.battleMode==="friend"
        ? [roomMember(state.friendRoomData,"host")?.displayName||"プレイヤー1",roomMember(state.friendRoomData,"guest")?.displayName||"プレイヤー2"]
        : ["あなた","CPU"];
      elements.startingRouletteLabelA.textContent=labels[0];elements.startingRouletteLabelB.textContent=labels[1];
      elements.startingRouletteResult.textContent="先攻を決めています…";
      overlay.classList.add("show");overlay.setAttribute("aria-hidden","false");
      const firstWins=state.battleMode==="friend"?startingPlayer==="host":startingPlayer==="human";
      wheel.style.transition="none";wheel.style.transform="rotate(0deg)";void wheel.offsetWidth;
      wheel.style.setProperty("--roulette-duration",`${duration}ms`);wheel.style.transition="";
      wheel.style.transform=`rotate(${1440+(firstWins?45:225)}deg)`;
      await delay(duration+80);
      elements.startingRouletteResult.textContent=`${startingPlayerDisplayName(startingPlayer)}が先攻！`;
      await delay(hold);
      overlay.classList.remove("show");overlay.setAttribute("aria-hidden","true");
      state.startingRouletteActive=false;render();
    }

    async function beginCpuStartingFlow(forcedStartingPlayer=null,rouletteOptions={}){
      const token=++state.startingFlowToken;
      const startingPlayer=forcedStartingPlayer||chooseStartingPlayer();
      state.startingPlayer=startingPlayer;state.startingPlayerDecided=true;state.turn=startingPlayer;state.startingRouletteActive=true;
      await playStartingRoulette(startingPlayer,rouletteOptions);
      if(token!==state.startingFlowToken||state.gameOver)return startingPlayer;
      await startTurn(startingPlayer);
      if(startingPlayer==="cpu"&&state.turn==="cpu"&&!state.gameOver&&state.mode==="attack"){await delay(350);await cpuTurn();}
      return startingPlayer;
    }

    async function beginFriendStartingFlow(match,rouletteOptions={}){
      const startingPlayer=match?.startingPlayer||match?.state?.startingPlayer;
      if(!startingPlayer)return null;
      state.startingPlayer=startingPlayer;state.startingPlayerDecided=true;
      const localStartingPlayer=localPlayerForStartingPlayer(startingPlayer);
      state.turn=localStartingPlayer;
      const snapshot=match?.state;
      const alreadyStarted=match?.turnStarted===true||snapshot?.turnStarted===true||snapshot?.[startingPlayer]?.firstTurnStarted===true;
      if(alreadyStarted)return startingPlayer;
      const token=++state.startingFlowToken;
      await playStartingRoulette(startingPlayer,rouletteOptions);
      if(token!==state.startingFlowToken||state.gameOver)return startingPlayer;
      if(localStartingPlayer==="human")await ensureFriendLocalTurnStarted();
      return startingPlayer;
    }

    function otherPlayer(player) {
      return player === "human" ? "cpu" : "human";
    }

    const elements = {
      message: document.getElementById("message"),
      deckEditorMessage: document.getElementById("deckEditorMessage"),
      log: document.getElementById("log"),
      menuScreen: document.getElementById("menuScreen"),
      battleSelectScreen: document.getElementById("battleSelectScreen"),
      friendLobbyScreen: document.getElementById("friendLobbyScreen"),
      difficultyScreen: document.getElementById("difficultyScreen"),
      settingsScreen: document.getElementById("settingsScreen"),
      deckEditorScreen: document.getElementById("deckEditorScreen"),
      menuStartBtn: document.getElementById("menuStartBtn"),
      menuTutorialBtn: document.getElementById("menuTutorialBtn"),
      tutorialWelcomeModal: document.getElementById("tutorialWelcomeModal"),
      tutorialWelcomeStartBtn: document.getElementById("tutorialWelcomeStartBtn"),
      tutorialWelcomeLaterBtn: document.getElementById("tutorialWelcomeLaterBtn"),
      tutorialWelcomeSkipBtn: document.getElementById("tutorialWelcomeSkipBtn"),
      tutorialScreen: document.getElementById("tutorialScreen"),
      tutorialExitBtn: document.getElementById("tutorialExitBtn"),
      tutorialChapterTitle: document.getElementById("tutorialChapterTitle"),
      tutorialChapterSubtitle: document.getElementById("tutorialChapterSubtitle"),
      tutorialChapterList: document.getElementById("tutorialChapterList"),
      tutorialStage: document.getElementById("tutorialStage"),
      tutorialProgressText: document.getElementById("tutorialProgressText"),
      tutorialProgressFill: document.getElementById("tutorialProgressFill"),
      tutorialMessageTitle: document.getElementById("tutorialMessageTitle"),
      tutorialMessageText: document.getElementById("tutorialMessageText"),
      tutorialCalculation: document.getElementById("tutorialCalculation"),
      tutorialSplitBtn: document.getElementById("tutorialSplitBtn"),
      tutorialNextBtn: document.getElementById("tutorialNextBtn"),
      tutorialSplitPanel: document.getElementById("tutorialSplitPanel"),
      tutorialHandCards: document.getElementById("tutorialHandCards"),
      tutorialChoicePanel: document.getElementById("tutorialChoicePanel"),
      tutorialChoiceTitle: document.getElementById("tutorialChoiceTitle"),
      tutorialChoiceYesBtn: document.getElementById("tutorialChoiceYesBtn"),
      tutorialChoiceNoBtn: document.getElementById("tutorialChoiceNoBtn"),
      tutorialRestartChapterBtn: document.getElementById("tutorialRestartChapterBtn"),
      tutorialBackToChaptersBtn: document.getElementById("tutorialBackToChaptersBtn"),
      tutorialHumanL: document.getElementById("tutorialHumanL"),
      tutorialHumanR: document.getElementById("tutorialHumanR"),
      tutorialCpuL: document.getElementById("tutorialCpuL"),
      tutorialCpuR: document.getElementById("tutorialCpuR"),
      tutorialHumanAttachments: document.getElementById("tutorialHumanAttachments"),
      tutorialCpuAttachments: document.getElementById("tutorialCpuAttachments"),
      realTutorialOverlay: document.getElementById("realTutorialOverlay"),
      realTutorialChapter: document.getElementById("realTutorialChapter"),
      realTutorialTitle: document.getElementById("realTutorialTitle"),
      realTutorialText: document.getElementById("realTutorialText"),
      realTutorialProgressFill: document.getElementById("realTutorialProgressFill"),
      realTutorialOkBtn: document.getElementById("realTutorialOkBtn"),
      realTutorialRetryBtn: document.getElementById("realTutorialRetryBtn"),
      realTutorialChaptersBtn: document.getElementById("realTutorialChaptersBtn"),
      menuDeckBtn: document.getElementById("menuDeckBtn"),
      menuSettingsBtn: document.getElementById("menuSettingsBtn"),
      menuNewsBtn: document.getElementById("menuNewsBtn"),
      newsUnreadBadge: document.getElementById("newsUnreadBadge"),
      newsModal: document.getElementById("newsModal"),
      newsCloseBtn: document.getElementById("newsCloseBtn"),
      newsFeaturedBanner: document.getElementById("newsFeaturedBanner"),
      newsFilterRow: document.getElementById("newsFilterRow"),
      newsList: document.getElementById("newsList"),
      majorUpdateModal: document.getElementById("majorUpdateModal"),
      majorUpdateDetailBtn: document.getElementById("majorUpdateDetailBtn"),
      majorUpdateCloseBtn: document.getElementById("majorUpdateCloseBtn"),
      plVsCpuBtn: document.getElementById("plVsCpuBtn"),
      plVsPlBtn: document.getElementById("plVsPlBtn"),
      battleSelectBackBtn: document.getElementById("battleSelectBackBtn"),
      createRoomBtn: document.getElementById("createRoomBtn"),
      openPublicRoomsBtn: document.getElementById("openPublicRoomsBtn"),
      copyRoomUrlBtn: document.getElementById("copyRoomUrlBtn"),
      roomUrlText: document.getElementById("roomUrlText"),
      roomEntryControls: document.getElementById("roomEntryControls"),
      battleRoomLobby: document.getElementById("battleRoomLobby"),
      battleRoomIdText: document.getElementById("battleRoomIdText"),
      battleRoomName: document.getElementById("battleRoomName"),
      battleRoomVisibilityBadge: document.getElementById("battleRoomVisibilityBadge"),
      battleRoomRegulation: document.getElementById("battleRoomRegulation"),
      battleRoomTags: document.getElementById("battleRoomTags"),
      battleRoomOpponentCard: document.getElementById("battleRoomOpponentCard"),
      battleRoomOpponentName: document.getElementById("battleRoomOpponentName"),
      battleRoomOpponentStatus: document.getElementById("battleRoomOpponentStatus"),
      battleRoomSelfCard: document.getElementById("battleRoomSelfCard"),
      battleRoomSelfName: document.getElementById("battleRoomSelfName"),
      battleRoomDeckName: document.getElementById("battleRoomDeckName"),
      battleRoomSelfStatus: document.getElementById("battleRoomSelfStatus"),
      battleRoomDeckEditBtn: document.getElementById("battleRoomDeckEditBtn"),
      battleRoomLeaveBtn: document.getElementById("battleRoomLeaveBtn"),
      battleVsCutIn: document.getElementById("battleVsCutIn"),
      battleVsOpponentName: document.getElementById("battleVsOpponentName"),
      battleVsSelfName: document.getElementById("battleVsSelfName"),
      roomIdInput: document.getElementById("roomIdInput"),
      joinRoomBtn: document.getElementById("joinRoomBtn"),
      friendLobbyMessage: document.getElementById("friendLobbyMessage"),
      roomStatusText: document.getElementById("roomStatusText"),
      roomPlayersText: document.getElementById("roomPlayersText"),
      friendReadyBtn: document.getElementById("friendReadyBtn"),
      friendUnreadyBtn: document.getElementById("friendUnreadyBtn"),
      friendReadyText: document.getElementById("friendReadyText"),
      friendStartBattleBtn: document.getElementById("friendStartBattleBtn"),
      friendLobbyBackBtn: document.getElementById("friendLobbyBackBtn"),
      difficultyBackBtn: document.getElementById("difficultyBackBtn"),
      settingsBackBtn: document.getElementById("settingsBackBtn"),
      compactCardDescriptionsToggle: document.getElementById("compactCardDescriptionsToggle"),
      deckCompactModeToggle: document.getElementById("deckCompactModeToggle"),
      deckBackMenuBtn: document.getElementById("deckBackMenuBtn"),
      battleBackMenuBtn: document.getElementById("battleBackMenuBtn"),
      battleRestartBtn: document.getElementById("battleRestartBtn"),
      friendSurrenderBtn: document.getElementById("friendSurrenderBtn"),
      surrenderFlowOverlay: document.getElementById("surrenderFlowOverlay"),
      surrenderFlowKicker: document.getElementById("surrenderFlowKicker"),
      surrenderFlowText: document.getElementById("surrenderFlowText"),
      surrenderFlowSub: document.getElementById("surrenderFlowSub"),
      battleResultReopenBtn: document.getElementById("battleResultReopenBtn"),
      humanState: document.getElementById("humanState"),
      cpuState: document.getElementById("cpuState"),
      humanPlayerName: document.getElementById("humanPlayerName"),
      cpuPlayerName: document.getElementById("cpuPlayerName"),
      startingPlayerRoulette: document.getElementById("startingPlayerRoulette"),
      startingRouletteWheel: document.getElementById("startingRouletteWheel"),
      startingRouletteLabelA: document.getElementById("startingRouletteLabelA"),
      startingRouletteLabelB: document.getElementById("startingRouletteLabelB"),
      startingRouletteResult: document.getElementById("startingRouletteResult"),
      splitBox: document.getElementById("splitBox"),
      splitLeft: document.getElementById("splitLeft"),
      splitRight: document.getElementById("splitRight"),
      splitHint: document.getElementById("splitHint"),
      andanteBox: document.getElementById("andanteBox"),
      andanteLabel: document.getElementById("andanteLabel"),
      andanteMinusBtn: document.getElementById("andanteMinusBtn"),
      andantePlusBtn: document.getElementById("andantePlusBtn"),
      andanteCancelBtn: document.getElementById("andanteCancelBtn"),
      allocationBox: document.getElementById("allocationBox"),
      allocationLabel: document.getElementById("allocationLabel"),
      allocationLeft: document.getElementById("allocationLeft"),
      allocationRight: document.getElementById("allocationRight"),
      allocationConfirmBtn: document.getElementById("allocationConfirmBtn"),
      allocationHint: document.getElementById("allocationHint"),
      handCardSelectionBox: document.getElementById("handCardSelectionBox"),
      handCardSelectionLabel: document.getElementById("handCardSelectionLabel"),
      handCardSelectionConfirmBtn: document.getElementById("handCardSelectionConfirmBtn"),
      handCardSelectionHint: document.getElementById("handCardSelectionHint"),
      attackBtn: document.getElementById("attackBtn"),
      splitBtn: document.getElementById("splitBtn"),
      drawBtn: document.getElementById("drawBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      resetBtn: document.getElementById("resetBtn"),
      confirmSplitBtn: document.getElementById("confirmSplitBtn"),
      humanCards: document.getElementById("humanCards"),
      directiveClearBadge: document.getElementById("directiveClearBadge"),
      humanDeckCount: document.getElementById("humanDeckCount"),
      cpuDeckCount: document.getElementById("cpuDeckCount"),
      handInfo: document.getElementById("handInfo"),
      lastCardDisplay: document.getElementById("lastCardDisplay"),
      overlay: document.getElementById("overlay"),
      willTorrentFx: document.getElementById("willTorrentFx"),
      willTorrentCount: document.getElementById("willTorrentCount"),
      directiveClearFx: document.getElementById("directiveClearFx"),
      directiveClearText: document.getElementById("directiveClearText"),
      specialFxLayer: document.getElementById("specialFxLayer"),
      specialFxTitle: document.getElementById("specialFxTitle"),
      specialFxSub: document.getElementById("specialFxSub"),
      popupCard: document.getElementById("popupCard"),
      popupUser: document.getElementById("popupUser"),
      popupName: document.getElementById("popupName"),
      popupText: document.getElementById("popupText"),
      trapChoice: document.getElementById("trapChoice"),
      trapChoiceText: document.getElementById("trapChoiceText"),
      trapChoiceList: document.getElementById("trapChoiceList"),
      trapSkipBtn: document.getElementById("trapSkipBtn"),
      peekResultModal: document.getElementById("peekResultModal"),
      peekResultText: document.getElementById("peekResultText"),
      peekResultList: document.getElementById("peekResultList"),
      peekResultConfirmBtn: document.getElementById("peekResultConfirmBtn"),
      toggleDeckBtn: document.getElementById("toggleDeckBtn"),
      deckPanel: document.getElementById("deckPanel"),
      deckGrid: document.getElementById("deckGrid"),
      deckBottomBar: document.getElementById("deckBottomBar"),
      deckBottomCount: document.getElementById("deckBottomCount"),
      deckBottomCost: document.getElementById("deckBottomCost"),
      deckBottomValid: document.getElementById("deckBottomValid"),
      deckCountText: document.getElementById("deckCountText"),
      deckCostText: document.getElementById("deckCostText"),
      deckSortSelect: document.getElementById("deckSortSelect"),
      deckSearchInput: document.getElementById("deckSearchInput"),
      deckTypeFilter: document.getElementById("deckTypeFilter"),
      deckCostFilter: document.getElementById("deckCostFilter"),
      deckThemeFilter: document.getElementById("deckThemeFilter"),
      deckOnlyToggle: document.getElementById("deckOnlyToggle"),
      deckUnselectedToggle: document.getElementById("deckUnselectedToggle"),
      deckFavoriteOnlyToggle: document.getElementById("deckFavoriteOnlyToggle"),
      deckSearchClearBtn: document.getElementById("deckSearchClearBtn"),
      deckSearchResultText: document.getElementById("deckSearchResultText"),
      deckDetailsBtn: document.getElementById("deckDetailsBtn"),
      deckValidityText: document.getElementById("deckValidityText"),
      applyDeckBtn: document.getElementById("applyDeckBtn"),
      defaultDeckBtn: document.getElementById("defaultDeckBtn"),
      clearDeckBtn: document.getElementById("clearDeckBtn"),
      deckSlotSelect: document.getElementById("deckSlotSelect"),
      deckSlotNameInput: document.getElementById("deckSlotNameInput"),
      deckSlotStatus: document.getElementById("deckSlotStatus"),
      deckInfoModal: document.getElementById("deckInfoModal"),
      deckInfoKicker: document.getElementById("deckInfoKicker"),
      deckInfoTitle: document.getElementById("deckInfoTitle"),
      deckInfoBody: document.getElementById("deckInfoBody"),
      deckInfoCloseBtn: document.getElementById("deckInfoCloseBtn"),
      costLimitInput: document.getElementById("costLimitInput"),
      deckOwnerSelect: document.getElementById("deckOwnerSelect"),
      cpuDifficultySelect: document.getElementById("cpuDifficultySelect"),
      cpuRegulationSelect: document.getElementById("cpuRegulationSelect"),
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
      attachmentDetailModal: document.getElementById("attachmentDetailModal"),
      attachmentDetailKind: document.getElementById("attachmentDetailKind"),
      attachmentDetailName: document.getElementById("attachmentDetailName"),
      attachmentDetailMeta: document.getElementById("attachmentDetailMeta"),
      attachmentDetailText: document.getElementById("attachmentDetailText"),
      attachmentDetailCloseBtn: document.getElementById("attachmentDetailCloseBtn"),
      helpModal: document.getElementById("helpModal"),
      helpCloseBtn: document.getElementById("helpCloseBtn"),
      helpTabs: document.getElementById("helpTabs"),
      helpBody: document.getElementById("helpBody"),
      battleResultModal: document.getElementById("battleResultModal"),
      battleResultKicker: document.getElementById("battleResultKicker"),
      battleResultTitle: document.getElementById("battleResultTitle"),
      battleResultText: document.getElementById("battleResultText"),
      battleResultPostActions: document.getElementById("battleResultPostActions"),
      battleResultRematchBtn: document.getElementById("battleResultRematchBtn"),
      battleResultDeckBtn: document.getElementById("battleResultDeckBtn"),
      battleResultLobbyBtn: document.getElementById("battleResultLobbyBtn"),
      battleResultWait: document.getElementById("battleResultWait"),
      battleResultViewBtn: document.getElementById("battleResultViewBtn")
    };

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function showPopup(player, title, text, kind = "card", ms = 760, html = false) {
      elements.popupCard.className =
        "popup-card" +
        (kind === "trap" ? " trap" : "") +
        (kind === "notice" ? " advance-notice" : "") +
        (kind === "charge-recoil" ? " charge-recoil" :
          kind === "emc2" ? " emc2" :
          kind === "scout" ? " scout" :
          kind === "card-detail" ? " card-detail" :
          kind === "turn-restriction" ? " turn-restriction" :
          kind === "magical-chant" ? " magical-chant" :
          kind === "arcana" ? " arcana" : "") +
        (kind === "emc2" ? " emc2" : "") +
        (kind === "scout" ? " scout" : "") +
        (kind === "card-detail" ? " card-detail" : "") +
        (kind === "accel" ? ` accel-flash ${player === "cpu" ? "cpu-accel" : "human-accel"}` : "");
      elements.popupUser.className =
        "popup-user" +
        (kind === "trap" ? " trap" :
          kind === "notice" ? " advance-notice" :
          kind === "charge-recoil" ? " charge-recoil" :
          kind === "accel" ? ` action ${player === "cpu" ? "cpu-accel-user" : "human-accel-user"}` :
          kind === "magical-chant" ? " magical-chant" :
          kind === "arcana" ? " arcana" :
          kind === "action" ? " action" : "");
      elements.popupUser.textContent =
        kind === "trap" ? `${handNames[player]}の罠発動` :
        kind === "notice" ? `${handNames[player]}の予告状` :
        kind === "charge-recoil" ? `${handNames[player]}の反動` :
        kind === "emc2" ? `${handNames[player]}の手札誘発` :
        kind === "scout" ? `${handNames[player]}の偵察` :
        kind === "card-detail" ? "カード詳細" :
        kind === "accel" ? `${handNames[player]}の加速` :
        kind === "magical-chant" ? `${handNames[player]}の詠唱` :
        kind === "arcana" ? `${handNames[player]}の大魔法` :
        kind === "action" ? `${handNames[player]}の行動` :
        `${handNames[player]}が使用`;
      elements.popupName.textContent = title;
      if (html) elements.popupText.innerHTML = text;
      else elements.popupText.textContent = text;
      elements.overlay.classList.add("show");
      await delay(ms);
      elements.overlay.classList.remove("show");
      await delay(120);
      elements.popupText.textContent = "";
    }

    const TURN_RESTRICTIONS = Object.freeze({
      intemperance: { title: "無節制の代償", text: name => `${name}はこのターン、カードを使用できません。通常攻撃・分ける・パスは可能です。`, accent: "restriction-intemperance" },
      appassionato: { title: "Appassionatoの反動", text: name => `${name}はこのターン、カードを使用できません。通常攻撃・分ける・パスは可能です。`, accent: "restriction-appassionato" },
      quarterRest: { title: "4分休符", text: name => `${name}はこのターン、手札からカードを使用できません。通常攻撃・分ける・パスは可能です。`, accent: "restriction-quarter-rest" },
      wholeRest: { title: "全休符", text: name => `${name}はこのターン通常ドローと通常攻撃を行えません。カードを使用できなくなった時、ターンを終了します。`, accent: "restriction-whole-rest" },
      prison: { title: "懲役", text: name => `${name}は「懲役」により、このターンはカードを使用できません。`, accent: "restriction-prison" },
      furioso: { title: "Furiosoの反動", text: name => `${name}はこのターン行動不能です。`, accent: "restriction-furioso" },
      berserker: { title: "バーサーカー", text: name => `${name}はこのターン攻撃が強化されますが、カード使用・罠設置・分けるを行えません。`, accent: "restriction-berserker" }
      ,directiveSilence:{title:"指令：沈黙",text:name=>`${name}は未達成の「指令：沈黙」により、このターンはカードを使用できません。`,accent:"restriction-prison"}
      ,directiveReform:{title:"指令：再編成",text:name=>`${name}はこのターン「分ける」を行えません。`,accent:"restriction-quarter-rest"}
      ,directiveComboSuccess:{title:"指令：連撃",text:name=>`${name}は達成報酬により、このターンの通常攻撃可能回数が1増えます。`,accent:"restriction-furioso"}
      ,directiveComboFailure:{title:"指令：連撃",text:name=>`${name}は未達成により、このターンの通常攻撃可能回数が1減ります（最低0）。`,accent:"restriction-furioso"}
      ,directiveReformSuccess:{title:"指令：再編成",text:name=>`${name}はこのターン、最初の「分ける」の後も行動を続けられます。`,accent:"restriction-quarter-rest"}
      ,directiveAnnihilation:{title:"指令：殲滅",text:name=>`${name}はこのターン、自分の効果で相手の手が7以上になった時、その手を0にします。`,accent:"restriction-appassionato"}
    });

    function cardUseLockRestrictionType(player) {
      const source = state.activeCardUseLockSource?.[player] || "intemperance";
      return source === "appassionato" ? "appassionato" : source === "directiveSilence" ? "directiveSilence" : "intemperance";
    }

    function getCardUseLockDisplayText(player) {
      if (!state.activeIntemperanceCardLock?.[player]) return "";
      const type = cardUseLockRestrictionType(player);
      if (type === "appassionato") return "Appassionato：このターン使用不可";
      if (type === "directiveSilence") return "指令：沈黙：このターン使用不可";
      return "無節制：このターン使用不可";
    }

    function getCardUseLockMessage(player) {
      const type = cardUseLockRestrictionType(player);
      const source = type === "appassionato" ? "Appassionatoの反動" : type === "directiveSilence" ? "未達成の「指令：沈黙」" : "「無節制」の代償";
      return `${getPlayerDisplayName(player, { includeYou: state.battleMode === "friend" })}は${source}により、このターンはカードを使用できません。`;
    }

    async function showTurnRestrictionPopup({ targetPlayer, restrictionType, broadcast = true }) {
      const config = TURN_RESTRICTIONS[restrictionType];
      if (!config || !targetPlayer) return;
      const name = getPlayerDisplayName(targetPlayer, { includeYou: state.battleMode === "friend" });
      if (broadcast && state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        await emitFriendFx("turnRestriction", {
          targetSide: friendSideForLocalPlayer(targetPlayer),
          restrictionType
        }).catch(error => console.error("PVP turn restriction fx failed", error));
      }
      elements.popupCard.dataset.restrictionAccent = config.accent;
      await showPopup(targetPlayer, config.title, config.text(name), "turn-restriction", 1100);
      delete elements.popupCard.dataset.restrictionAccent;
    }

    async function showCardPopup(player, card, isTrap = false, ms = 760) {
      await showPopup(player, `「${card.name}」`, card.text, isTrap ? "trap" : "card", ms);
    }

    async function showAdvanceNoticeRevealPopup(player, card, ms = 1100) {
      const body =
        `<div class="advance-notice-popup-label">次の自分のターン開始時に発動</div>` +
        `<div class="advance-notice-popup-effect">${escapeHtml(card.text)}</div>`;
      await showPopup(player, `予告「${card.name}」`, body, "notice", ms, true);
    }

    async function showChargeRecoilPopup(player, source, ms = 1250) {
      const safeSource = source || "充電効果";
      const body =
        `<div class="charge-recoil-popup-label">${escapeHtml(safeSource)}の反動</div>` +
        `<div class="charge-recoil-popup-main">このターンは行動不能</div>` +
        `<div class="charge-recoil-popup-sub">カード使用・攻撃・分けるを行わず、自動的にターンを終了します。</div>`;
      await showPopup(player, "⚡ 反動発生", body, "charge-recoil", ms, true);
    }

    async function showFinaleFx(player, power) {
      const layer = elements.specialFxLayer;
      if (!layer) return;
      elements.specialFxTitle.textContent = "FINALE";
      elements.specialFxSub.textContent = `${handNames[player]}の両手の合計 ${power}`;
      layer.className = "special-fx-layer finale-fx prepare";
      layer.setAttribute("aria-hidden", "false");
      await delay(760);
      layer.classList.remove("prepare");
      layer.classList.add("reveal");
      await delay(980);
      layer.classList.add("flash");
      await delay(620);
      layer.classList.remove("flash");
      await delay(520);
      layer.className = "special-fx-layer";
      layer.setAttribute("aria-hidden", "true");
    }

    async function showLogicAtelierFx(player, defender, targetHand) {
      const layer = elements.specialFxLayer;
      const target = handEl(defender, targetHand);
      if (!layer || !target) return;

      elements.specialFxTitle.textContent = "LOGIC ATELIER";
      elements.specialFxSub.textContent = `${handNames[player]} → ${handNames[defender]}の${handNames[targetHand]}`;
      layer.className = "special-fx-layer logic-fx lock";
      layer.setAttribute("aria-hidden", "false");
      target.classList.add("logic-mark");
      await delay(420);

      layer.classList.remove("lock");
      layer.classList.add("dash");
      await delay(430);

      target.classList.remove("logic-mark");
      target.classList.add("logic-shatter");
      layer.classList.add("logic-flash");
      await delay(760);

      layer.classList.remove("logic-flash");
      target.classList.remove("logic-shatter");
      target.classList.add("logic-aftershock");
      await delay(420);
      target.classList.remove("logic-aftershock");
      layer.className = "special-fx-layer";
      layer.setAttribute("aria-hidden", "true");
    }

    async function showLightSpeedCircuitFx(player) {
      const layer = elements.specialFxLayer;
      if (!layer) return;

      elements.specialFxTitle.textContent = "OVERCLOCK";
      elements.specialFxSub.textContent = `${handNames[player]}の光速回路起動 / 充電カード使用制限解除`;
      layer.className = "special-fx-layer overclock-fx charge";
      layer.setAttribute("aria-hidden", "false");

      await delay(520);
      layer.classList.remove("charge");
      layer.classList.add("ignite");

      await delay(920);
      layer.classList.add("burst");

      await delay(620);
      layer.classList.remove("burst");
      await delay(360);

      layer.className = "special-fx-layer";
      layer.setAttribute("aria-hidden", "true");
    }

    async function animateFinaleDamage(defender, results) {
      const active = results.filter(item => item.before > 0);
      for (const item of active) {
        const target = handEl(defender, item.hand);
        target?.classList.add("finale-target");
        document.getElementById(`${defender}${item.hand}Num`).textContent = item.total;
        document.getElementById(`${defender}${item.hand}Icons`).textContent = "☝".repeat(Math.min(item.total, 9));
        document.getElementById(`${defender}${item.hand}Calc`).textContent = item.total >= 5 ? `→ ${item.finalValue}` : "";
      }
      await delay(680);
      active.forEach(item => handEl(defender, item.hand)?.classList.remove("finale-target"));
      clearHighlights();
    }

    async function applyFinale(player) {
      const defender = player === "human" ? "cpu" : "human";
      const power = Math.max(0, state[player].L + state[player].R);
      if (state.battleMode === "friend" && player === "human") {
        emitFriendFx("finale", { playerSide: friendSideForLocalPlayer(player), power }).catch(error => console.error("PVP finale fx failed", error));
      }
      await showFinaleFx(player, power);

      const results = ["L", "R"].map(hand => {
        const before = state[defender][hand];
        if (before <= 0) return { hand, before, total: before, finalValue: before };
        const total = before + power;
        const finalValue = normalize(total, defender, hand);
        return { hand, before, total, finalValue };
      });
      await animateFinaleDamage(defender, results);
      for (const item of results) {
        if (item.before > 0) state[defender][item.hand] = item.finalValue;
      }
      addLog(`${handNames[player]}の「フィナーレ」。${handNames[defender]}の両手それぞれに${power}本分を加えた。`);
      setLastAction(player, "フィナーレ", `相手の両手それぞれに${power}本分を加えた。`, "card");
      clearBrokenTraps(defender);
      render();
    }

    async function showAccelerationPopup(player, draws, remaining) {
      await showPopup(
        player,
        "過加速",
        `<div class="roulette-pop">${player === "cpu" ? `${getPlayerDisplayName(player)} +1 DRAW` : "+1 DRAW"}</div><div>${handNames[player]}はこのターン${draws}枚ドローします。<br>追加ドロー残り：${remaining}ターン</div>`,
        "accel",
        900,
        true
      );
    }

    async function showNoDrawPopup(player, remaining) {
      await showPopup(
        player,
        "過加速の反動",
        `<div class="roulette-pop">${player === "cpu" ? `${getPlayerDisplayName(player)} NO DRAW` : "NO DRAW"}</div><div>${handNames[player]}はこのターン開始時にカードを引けません。<br>反動残り：${remaining}ターン</div>`,
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
      // 元の配列を直接シャッフルする。
      // 戻り値を代入する呼び出し方と、shuffle(deck)だけの呼び出し方の両方に対応。
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    
    function makeRoomId() {
      return Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    function makeShortRoomCode(){
      const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
      return Array.from(bytes,value=>alphabet[value%alphabet.length]).join("");
    }
    function normalizeShortRoomCode(value){return String(value||"").trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);}
    function regulationDefinition(id,version){const def=REGULATION_DEFS[id];return def&&def.version===Number(version)?def:null;}
    function regulationSnapshot(id="standard"){const def=REGULATION_DEFS[id];if(!def)throw new Error("この対戦ルールには現在対応していません。");return {modeId:def.id,modeVersion:def.version,options:{}};}
    function activeRegulation(){return state.friendRoomData?.regulation||state.currentRegulation||DEFAULT_REGULATION;}
    function activeRuleDefinition(){const rule=activeRegulation();return regulationDefinition(rule?.modeId,rule?.modeVersion)||REGULATION_DEFS.standard;}
    function isRomanGimmick(){return activeRuleDefinition().id==="romanGimmick";}
    function romanCompletedTurns(player){const started=Number(state.personalTurnCount?.[player]||0);return Math.max(0,started-(state.turn===player?1:0));}
    function romanPreparationCounts(){return {human:romanCompletedTurns("human"),cpu:romanCompletedTurns("cpu")};}
    function romanRemainingPreparationTurns(player){return Math.max(0,(activeRuleDefinition().preparationTurns||3)-romanCompletedTurns(player));}
    function isRomanPreparation(){if(!isRomanGimmick())return false;return romanRemainingPreparationTurns("human")>0||romanRemainingPreparationTurns("cpu")>0;}
    function isRomanOpponentTarget(actor,target){return isRomanPreparation()&&actor&&target===otherPlayer(actor);}
    function isCardBlockedInRomanPreparation(player,cardId){const card=CARD_LIBRARY[effectiveCardIdForPlayer(player,cardId)]||CARD_LIBRARY[cardId];return isRomanPreparation()&&!!card&&(card.curse||ROMAN_PREPARATION_BLOCKED_NAMES.has(card.name));}
    function canUseCardUnderRule(player,cardId,{silent=false}={}){if(!isCardBlockedInRomanPreparation(player,cardId))return true;if(!silent&&player==="human")setMessage(`「${CARD_LIBRARY[effectiveCardIdForPlayer(player,cardId)]?.name||CARD_LIBRARY[cardId]?.name||"このカード"}」は準備時間中使用できません。`);return false;}
    function isRomanTemporarilyProtectedHandCard(cardId){return isRomanPreparation()&&ROMAN_PROTECTED_BULLET_NAMES.has(CARD_LIBRARY[cardId]?.name);}
    function getDeckRestrictionReason(ruleId,cardId){const rule=REGULATION_DEFS[ruleId],card=CARD_LIBRARY[cardId];if(!card)return "";if(card.token)return "生成カードはデッキ投入不可";if(!rule?.deckRestrictions)return "";if(rule.deckRestrictions.finalVerdictNames?.includes(card.name)||rule.deckRestrictions.blockedCardNames?.includes(card.name))return `${rule.name}では使用不可`;if(rule.deckRestrictions.blockedGroups?.includes("harpoonTheme")&&card.harpoonTheme)return `${rule.name}では銛系カードを使用不可`;return "";}
    function isCardAllowedInDeckForRule(ruleId,cardId){return !getDeckRestrictionReason(ruleId,cardId);}
    function validateDeckForRule(ruleId,counts){const invalid=[...new Set(Object.entries(counts||{}).filter(([,n])=>Number(n)>0).map(([id])=>id).filter(id=>!isCardAllowedInDeckForRule(ruleId,id)))];return {valid:invalid.length===0,invalidCardIds:invalid,names:invalid.map(id=>CARD_LIBRARY[id]?.name||id)};}
    function ruleDeckValidationMessage(ruleId,counts){const result=validateDeckForRule(ruleId,counts),rule=REGULATION_DEFS[ruleId];return result.valid?"":`「${rule?.name||"このルール"}」では使えないカードがデッキに含まれています。対象：${result.names.join("、")}`;}
    function openRuleDetail(ruleId){const rule=REGULATION_DEFS[ruleId]||REGULATION_DEFS.standard,title=document.getElementById("ruleDetailTitle"),body=document.getElementById("ruleDetailBody");title.textContent=rule.name;body.replaceChildren();const summary=document.createElement("p");summary.textContent=rule.summary;body.append(summary);const addSection=(heading,items)=>{if(!items?.length)return;const h=document.createElement("h3");h.textContent=heading;const ul=document.createElement("ul");for(const text of items){const li=document.createElement("li");li.textContent=text;ul.append(li);}body.append(h,ul);};addSection("概要",rule.details);if(rule.id==="romanGimmick"){addSection("準備時間中使用不可",[...rule.preparationBlockedNames,"すべての呪縛"]);addSection("準備時間中捨てられない弾",rule.protectedBulletNames);addSection("デッキ投入不可",[...rule.deckRestrictions.finalVerdictNames,...(rule.deckRestrictions.blockedCardNames||[]),"銛投擲","銛を埋める","グングニル","銛系すべて"]);}socialOpen("ruleDetailModal");}
    function normalizeRoomTags(tags){const unique=[...new Set((tags||[]).filter(id=>Object.hasOwn(ROOM_TAG_DEFS,id)))];if(unique.length>ROOM_TAG_MAX)throw new Error(`タグは${ROOM_TAG_MAX}個まで選択できます。`);return unique;}
    function defaultRoomName(){return `${currentRoomMemberPresentation().displayName}の部屋`;}
    function normalizeRoomName(value){const raw=String(value||"");if(/[\r\n\u0000-\u001f\u007f]/.test(raw))throw new Error("部屋名に改行や制御文字は使用できません。");const clean=raw.trim()||defaultRoomName();if(clean.length<1||clean.length>30)throw new Error("部屋名は30文字以内で入力してください。");return clean;}
    function publicRoomMetadata(roomId,room){const def=regulationDefinition(room.regulation?.modeId,room.regulation?.modeVersion);return {roomId,roomName:room.roomName,creatorUid:room.hostUid,creatorName:room.members.slot0.displayName,regulationId:room.regulation.modeId,regulationVersion:room.regulation.modeVersion,regulationName:def?.name||"不明なルール",tags:[...(room.tags||[])],createdAt:room.createdAt,updatedAt:room.updatedAt};}
    function roomTagLabels(tags){return (tags||[]).map(id=>ROOM_TAG_DEFS[id]).filter(Boolean);}

    function getFriendClientId() {
      const storageKey = "waribashiFriendClientId";
      try {
        let clientId = sessionStorage.getItem(storageKey);
        if (!clientId) {
          clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
          sessionStorage.setItem(storageKey, clientId);
        }
        return clientId;
      } catch (_) {
        if (!state.friendFallbackClientId) {
          state.friendFallbackClientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        }
        return state.friendFallbackClientId;
      }
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
        return match ? decodeURIComponent(match[1]).trim() : raw.replace(/[^a-zA-Z0-9_-]/g, "").trim();
      }
    }

    async function resolveRoomCode(value){
      const fb=firebaseApi(),raw=extractRoomId(value),code=normalizeShortRoomCode(raw);if(!fb||!/^[A-HJ-NP-Z2-9]{6}$/.test(String(raw).toUpperCase()))return {roomId:raw,shortCode:""};
      const codeRef=fb.doc(fb.db,"roomCodes",code),snap=await fb.getDoc(codeRef);if(!snap.exists())throw Object.assign(new Error("ROOM_NOT_FOUND"),{code:"ROOM_NOT_FOUND"});
      const roomId=snap.data().roomId;try{const roomSnap=await fb.getDoc(fb.doc(fb.db,"rooms",roomId));if(!roomSnap.exists()){await fb.deleteDoc(codeRef).catch(()=>{});throw Object.assign(new Error("ROOM_NOT_FOUND"),{code:"ROOM_NOT_FOUND"});}}catch(error){if(error?.code==="ROOM_NOT_FOUND"||error?.message==="ROOM_NOT_FOUND")throw error;}
      return {roomId,shortCode:code};
    }

    function renderRoomTagControls(){
      for(const id of ["roomTagPicker","publicRoomTagFilter"]){const box=document.getElementById(id);if(!box)continue;box.replaceChildren();for(const [tag,label] of Object.entries(ROOM_TAG_DEFS)){const item=document.createElement("label");item.className="room-tag-chip";const input=document.createElement("input");input.type="checkbox";input.value=tag;input.checked=id==="publicRoomTagFilter"&&state.publicRoomFilters.tags.includes(tag);const text=document.createElement("span");text.textContent=label;item.append(input,text);box.append(item);}}
    }
    function selectedCheckboxValues(containerId){return [...document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`)].map(input=>input.value);}
    function openRoomCreateSettings(){renderRoomTagControls();document.getElementById("roomNameInput").value="";document.querySelector('input[name="roomVisibility"][value="private"]').checked=true;document.getElementById("roomRegulationSelect").value="standard";document.getElementById("roomCreateMessage").textContent="";socialOpen("roomCreateModal");}
    async function submitRoomCreateSettings(){if(state.roomCreateBusy)return;const button=document.getElementById("roomCreateConfirmBtn");button.disabled=true;try{const visibility=document.querySelector('input[name="roomVisibility"]:checked')?.value||"private",tags=normalizeRoomTags(selectedCheckboxValues("roomTagPicker")),roomName=normalizeRoomName(document.getElementById("roomNameInput").value),regulationId=document.getElementById("roomRegulationSelect").value;await createFriendRoom({visibility,tags,roomName,regulationId});socialClose("roomCreateModal");}catch(error){document.getElementById("roomCreateMessage").textContent=roomCreateErrorMessage(error);}finally{button.disabled=false;}}
    function filteredPublicRooms(rooms=state.publicRooms){const rule=state.publicRoomFilters.regulationId,tags=state.publicRoomFilters.tags;return rooms.filter(room=>(rule==="all"||room.regulationId===rule)&&tags.every(tag=>(room.tags||[]).includes(tag))&&!!regulationDefinition(room.regulationId,room.regulationVersion));}
    function renderPublicRooms(){const list=document.getElementById("publicRoomList");if(!list)return;list.replaceChildren();const rooms=filteredPublicRooms();if(!rooms.length){const empty=document.createElement("p");empty.className="small";empty.textContent="条件に合う公開ルームはありません。";list.append(empty);return;}for(const room of rooms){const row=document.createElement("div");row.className="public-room-row";const name=document.createElement("button");name.className="public-room-name";name.textContent=String(room.roomName||"公開ルーム");name.addEventListener("click",()=>openPublicRoomDetail(room));const creator=document.createElement("span");creator.className="public-room-creator";creator.textContent=String(room.creatorName||"プレイヤー");const rule=document.createElement("span");rule.className="public-room-rule";rule.textContent=regulationDefinition(room.regulationId,room.regulationVersion)?.name||"未対応";const tags=document.createElement("span");tags.className="public-room-tags";tags.textContent=roomTagLabels(room.tags).join(" / ")||"タグなし";const join=document.createElement("button");join.textContent="参加";join.addEventListener("click",()=>claimPublicRoom(room.roomId));row.append(name,creator,rule,tags,join);list.append(row);}}
    async function cleanupPublicRoomCandidate(room){
      const fb=firebaseApi();if(!fb||!room?.roomId)return false;
      const updated=socialTimestampMillis(room.updatedAt||room.createdAt);if(updated&&Date.now()-updated<ORPHAN_ROOM_GRACE_MS)return false;
      const roomRef=fb.doc(fb.db,"rooms",room.roomId),publicRef=fb.doc(fb.db,"publicRooms",room.roomId);
      let data=null;
      try{const snap=await fb.getDoc(roomRef);if(snap.exists())data=snap.data()||{};}catch(_){}
      if(data&&data.status==="lobby"&&data.visibility==="public"&&data.guestUid==null&&data.guestJoined===false&&data.members?.slot1==null){
        try{await fb.updateDoc(roomRef,{status:"closed",updatedAt:fb.serverTimestamp()});if(data.shortCode)await fb.deleteDoc(fb.doc(fb.db,"roomCodes",data.shortCode)).catch(()=>{});}catch(_){}
      }
      try{await fb.deleteDoc(publicRef);return true;}catch(_){return false;}
    }
    async function cleanupStalePublicRoomEntries(rooms){
      const stale=(rooms||[]).filter(room=>{const updated=socialTimestampMillis(room.updatedAt||room.createdAt);return !updated||Date.now()-updated>=ORPHAN_ROOM_GRACE_MS;});
      if(!stale.length)return 0;const results=await Promise.allSettled(stale.map(cleanupPublicRoomCandidate));return results.filter(result=>result.status==="fulfilled"&&result.value).length;
    }
    async function fetchPublicRooms({preserveOnError=true}={}){const fb=firebaseApi();if(!fb)throw new Error("Firebaseに接続されていません。");const generation=++state.publicRoomRefreshGeneration,button=document.getElementById("publicRoomsRefreshBtn");button.disabled=true;button.textContent="更新中…";try{let snap=await fb.getDocs(fb.query(fb.collection(fb.db,"publicRooms"),fb.limit(PUBLIC_ROOM_LIMIT)));if(generation!==state.publicRoomRefreshGeneration)return state.publicRooms;const first=docsFromSnapshot(snap);const cleaned=await cleanupStalePublicRoomEntries(first);if(cleaned&&generation===state.publicRoomRefreshGeneration)snap=await fb.getDocs(fb.query(fb.collection(fb.db,"publicRooms"),fb.limit(PUBLIC_ROOM_LIMIT)));if(generation!==state.publicRoomRefreshGeneration)return state.publicRooms;state.publicRooms=docsFromSnapshot(snap).filter(room=>!!regulationDefinition(room.regulationId,room.regulationVersion));renderPublicRooms();document.getElementById("publicRoomsMessage").textContent=`${state.publicRooms.length}件取得・最終更新：たった今${cleaned?`（古い部屋を${cleaned}件整理）`:""}`;return state.publicRooms;}catch(error){if(!preserveOnError)state.publicRooms=[];document.getElementById("publicRoomsMessage").textContent="公開ルームの取得に失敗しました。";throw error;}finally{if(generation===state.publicRoomRefreshGeneration){button.disabled=false;button.textContent="更新";}}}
    function openPublicRoomDetail(room){state.selectedPublicRoom=room;document.getElementById("publicRoomDetailName").textContent=String(room.roomName||"公開ルーム");document.getElementById("publicRoomDetailCreator").textContent=String(room.creatorName||"プレイヤー");const def=regulationDefinition(room.regulationId,room.regulationVersion);document.getElementById("publicRoomDetailRule").textContent=def?.name||"未対応";document.getElementById("publicRoomDetailDescription").textContent=def?.description||"このルールには対応していません。";document.getElementById("publicRoomDetailTags").textContent=roomTagLabels(room.tags).join(" / ")||"なし";document.getElementById("publicRoomDetailJoinBtn").disabled=!def;socialOpen("publicRoomDetailModal");}
    async function claimPublicRoom(roomId){if(state.publicRoomBusy)return false;state.publicRoomBusy=true;try{await joinFriendRoom(roomId,{internalRoomId:true,publicOnly:true});socialClose("publicRoomDetailModal");return state.friendRoomId===roomId;}catch(error){return false;}finally{state.publicRoomBusy=false;}}
    function shuffled(values){return shuffle([...values]);}
    async function quickMatchPublicRoom(){if(state.publicRoomBusy||state.friendRoomId)return;state.publicRoomBusy=true;const button=document.getElementById("quickMatchBtn");button.disabled=true;try{const latest=await fetchPublicRooms();const me=firebaseApi()?.uid,candidates=shuffled(filteredPublicRooms(latest).filter(room=>room.creatorUid!==me)).slice(0,5);for(const room of candidates){state.publicRoomBusy=false;const joined=await claimPublicRoom(room.roomId);state.publicRoomBusy=true;if(joined)return;}document.getElementById("publicRoomsMessage").textContent="参加可能な部屋が見つかりませんでした";}finally{state.publicRoomBusy=false;button.disabled=false;}}

    function firebaseApi() {
      const api=window.WaribashiFirebase;
      if(!api?.ready||!api?.authReady||!api?.authUser||!api?.uid)return null;
      state.firebaseAuthReady=true;
      state.firebaseAuthUser=api.authUser;
      state.firebaseUid=api.uid;
      state.firebaseAuthError=null;
      return api;
    }

    function updateFriendAuthUi() {
      const api=window.WaribashiFirebase;
      const ready=!!(api?.ready&&api?.authReady&&api?.authUser&&api?.uid);
      state.firebaseAuthReady=ready;
      state.firebaseAuthUser=ready?api.authUser:null;
      state.firebaseUid=ready?api.uid:null;
      state.firebaseAuthError=api?.error||null;
      if(elements?.createRoomBtn)elements.createRoomBtn.disabled=!ready;
      if(elements?.joinRoomBtn)elements.joinRoomBtn.disabled=!ready;
      if(!ready){
        if(elements?.friendReadyBtn)elements.friendReadyBtn.disabled=true;
        if(elements?.friendUnreadyBtn)elements.friendUnreadyBtn.disabled=true;
        if(elements?.friendStartBattleBtn)elements.friendStartBattleBtn.disabled=true;
        if(state.currentScreen==="friendLobby"&&elements?.friendLobbyMessage){
          elements.friendLobbyMessage.textContent=api?.error
            ?"オンライン認証に失敗しました。しばらくしてからもう一度お試しください。"
            :"オンライン接続を準備しています…";
        }
      }
      return ready;
    }

    function friendFirestoreErrorMessage(error, fallback="オンライン通信に失敗しました。") {
      if(error?.code==="permission-denied")return "この部屋へのアクセス権がありません。";
      if(!state.firebaseAuthReady||error?.code?.startsWith?.("auth/"))return "オンライン認証に失敗しました。しばらくしてからもう一度お試しください。";
      if(error?.code==="unavailable")return "通信できません。接続を確認してもう一度お試しください。";
      return fallback;
    }
    function roomCreateErrorMessage(error){
      if(error?.code==="permission-denied")return "ルームの作成権限が確認できませんでした。再読み込みしてもう一度お試しください。";
      if(error?.code==="ACTIVE_ROOM_EXISTS")return "別の対戦ルームに所属しています。";
      if(error?.code==="ROOM_IN_MATCH"||error?.message==="ROOM_IN_MATCH")return "対戦中のルームは解散できません。";
      if(error?.code==="unavailable")return "通信できません。接続を確認してください。";
      return friendFirestoreErrorMessage(error,"ルームを作成できませんでした。");
    }

    /* ACCOUNT / SOCIAL RULE:
     * Anonymous Auth remains the default. A permanent account links the current
     * anonymous credential where possible. Public identity never contains email;
     * displayName#tag is reserved atomically in playerTags using the five-digit tag.
     */
    const socialEl = id => document.getElementById(id);
    const socialOpen = id => { const el=socialEl(id); if(el){el.classList.add("show");el.setAttribute("aria-hidden","false");} };
    const socialClose = id => { const el=socialEl(id); if(el){el.classList.remove("show");el.setAttribute("aria-hidden","true");} };
    const openAccountChildModal = id => { socialClose("accountModal");socialOpen(id); };
    const closeAccountChildModal = id => { socialClose(id);renderSocialAccountUi();socialOpen("accountModal"); };
    const socialMessage = (id,text="") => { const el=socialEl(id); if(el)el.textContent=text; };
    const isFormalAccount = user => !!user && !user.isAnonymous;
    const socialRequestId = (fromUid,toUid) => `${fromUid}_${toUid}`;
    const socialProfileFields = profile => ({uid:profile.uid,displayName:profile.displayName,tag:profile.tag,publicId:profile.publicId});
    const DEFAULT_BACKGROUND_IDS = Object.freeze(["default","blue","red","green","purple"]);
    const DEFAULT_TITLE_IDS = Object.freeze(["rookie"]);
    const PLAYER_CARD_BACKGROUNDS = Object.freeze({
      default:{label:"ノーマル"},blue:{label:"ブルー"},red:{label:"レッド"},green:{label:"グリーン"},purple:{label:"パープル"},gold:{label:"ゴールド"}
    });
    const PLAYER_TITLES = Object.freeze({rookie:{label:"ルーキー"},operator:{label:"運営者"}});
    const uniqueKnownIds = (values,definitions,fallback) => [...new Set([...fallBackArray(fallback),...(Array.isArray(values)?values:[])])].filter(id=>Object.hasOwn(definitions,id));
    const fallBackArray = values => [...values];
    function normalizedPlayerCardProfile(profile={}){
      const unlockedBackgroundIds=uniqueKnownIds(profile.unlockedBackgroundIds,PLAYER_CARD_BACKGROUNDS,DEFAULT_BACKGROUND_IDS);
      const unlockedTitleIds=uniqueKnownIds(profile.unlockedTitleIds,PLAYER_TITLES,DEFAULT_TITLE_IDS);
      const requestedBackground=String(profile.backgroundId||profile.bannerId||"default");
      const requestedTitle=String(profile.titleId||"rookie");
      return {...profile,backgroundId:unlockedBackgroundIds.includes(requestedBackground)&&PLAYER_CARD_BACKGROUNDS[requestedBackground]?requestedBackground:"default",titleId:unlockedTitleIds.includes(requestedTitle)&&PLAYER_TITLES[requestedTitle]?requestedTitle:"rookie",unlockedBackgroundIds,unlockedTitleIds};
    }
    function canonicalProfileMigration(storedProfile={}){
      const canonical=normalizedPlayerCardProfile(storedProfile),migration={};
      if(storedProfile.bannerId!==canonical.backgroundId)migration.bannerId=canonical.backgroundId;
      if(storedProfile.backgroundId!==canonical.backgroundId)migration.backgroundId=canonical.backgroundId;
      if(storedProfile.titleId!==canonical.titleId)migration.titleId=canonical.titleId;
      if(JSON.stringify(storedProfile.unlockedBackgroundIds)!==JSON.stringify(canonical.unlockedBackgroundIds))migration.unlockedBackgroundIds=[...canonical.unlockedBackgroundIds];
      if(JSON.stringify(storedProfile.unlockedTitleIds)!==JSON.stringify(canonical.unlockedTitleIds))migration.unlockedTitleIds=[...canonical.unlockedTitleIds];
      return migration;
    }
    function playerCardPresentation(profile={},fallback="プレイヤー"){
      const requestedBackground=String(profile.backgroundId||profile.bannerId||"default"),requestedTitle=String(profile.titleId||"rookie");
      return {displayName:String(profile.guestLabel||profile.displayName||fallback),backgroundId:PLAYER_CARD_BACKGROUNDS[requestedBackground]?requestedBackground:"default",titleId:PLAYER_TITLES[requestedTitle]?requestedTitle:"rookie",isGuest:profile.registered===false};
    }
    function applyPlayerCardElement(card,presentation,{nameElement=null,titleElement=null}={}){
      if(!card)return;const normalized=playerCardPresentation(presentation,presentation.displayName);
      card.dataset.backgroundId=normalized.backgroundId;card.dataset.titleId=normalized.titleId;
      card.classList.toggle("player-card-gold",normalized.backgroundId==="gold");
      card.classList.toggle("is-guest",normalized.isGuest);
      if(nameElement)nameElement.textContent=normalized.displayName;
      const title=titleElement||card.querySelector("[data-title-slot]");if(title)title.textContent=PLAYER_TITLES[normalized.titleId]?.label||PLAYER_TITLES.rookie.label;
    }
    const socialTimestampMillis = value => value?.toMillis?.() || Number(value?.seconds||0)*1000 || Number(value||0);
    const authPersistenceEnabled = () => localStorage.getItem("waribashi-auth-persistence") !== "session";
    const normalizePlayerName = value => String(value||"").normalize("NFKC").trim();
    const normalizePublicId = value => String(value||"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
    function validatePlayerName(value){
      const name=normalizePlayerName(value);
      if(name.length<1||name.length>20||/[\r\n\u0000-\u001f\u007f]/.test(name))throw new Error("プレイヤー名は1～20文字で入力してください。");
      return name;
    }
    function makePlayerTag(){
      const values=new Uint32Array(1);crypto.getRandomValues(values);
      return String(values[0]%100000).padStart(5,"0");
    }
    function firebaseAuthErrorMessage(error){
      const messages={
        "auth/invalid-email":"メールアドレスの形式を確認してください。","auth/invalid-credential":"メールアドレスまたはパスワードが違います。",
        "auth/email-already-in-use":"このメールアドレスはすでに使用されています。","auth/weak-password":"パスワードは6文字以上にしてください。",
        "auth/popup-closed-by-user":"Googleログインがキャンセルされました。","auth/network-request-failed":"通信できません。接続を確認してください。"
      };
      return messages[error?.code]||error?.message||"処理に失敗しました。";
    }
    async function applyAuthPersistence(remember,{announce=false}={}){
      const fb=window.WaribashiFirebase;if(!fb?.auth||!fb?.setPersistence)throw new Error("認証を準備しています。");
      try{
        await fb.setPersistence(fb.auth,remember?fb.browserLocalPersistence:fb.browserSessionPersistence);
        localStorage.setItem(fb.persistenceKey||"waribashi-auth-persistence",remember?"local":"session");
        fb.rememberLogin=remember;
        ["authRememberCheckbox","registerRememberCheckbox","accountRememberCheckbox"].forEach(id=>{const input=socialEl(id);if(input)input.checked=remember;});
        if(announce)socialMessage("accountMessage",remember?"ログイン状態を保持します。":"このブラウザセッション中だけログイン状態を保持します。");
      }catch(error){
        console.error("[Auth] persistence update failed",error?.code,error?.message);
        throw new Error("ログイン状態の保持設定を変更できませんでした。");
      }
    }
    const selectedLoginPersistence = register => !!socialEl(register?"registerRememberCheckbox":"authRememberCheckbox")?.checked;
    function socialOperationError(error,operation){
      if(error?.code!=="permission-denied")return firebaseAuthErrorMessage(error);
      if(operation==="request")return "このプレイヤーには現在申請できません。";
      if(operation==="invite")return "このプレイヤーには現在対戦を申し込めません。";
      if(operation==="accept")return "フレンド申請の承認に失敗しました。状態が更新されている可能性があります。";
      return "状態が更新されています。もう一度お試しください。";
    }
    function cleanupSocialListeners(){
      [...state.socialListenerUnsubs,...state.socialInviteUnsubs].forEach(unsub=>{try{unsub?.();}catch(_){}});
      state.socialListenerUnsubs=[];state.socialInviteUnsubs=[];
      if(state.socialInviteTimer)clearInterval(state.socialInviteTimer);
      state.socialInviteTimer=null;state.socialInviteToastId=null;
      state.socialInviteHandoffTimers.forEach(timer=>clearTimeout(timer));state.socialInviteHandoffTimers.clear();state.socialInviteHandoffExpired.clear();state.socialInviteCreatingRooms.clear();state.socialInviteJoiningRooms.clear();state.socialInviteCleanupPending.clear();
    }
    async function createSocialProfile(displayName,user=window.WaribashiFirebase?.authUser){
      const fb=firebaseApi();if(!fb||!isFormalAccount(user))throw new Error("正式アカウントへログインしてください。");
      const name=validatePlayerName(displayName);
      for(let attempt=0;attempt<30;attempt+=1){
        const tag=makePlayerTag(), publicId=`${name}#${tag}`;
        try{
          const profile=await fb.runTransaction(fb.db,async transaction=>{
            const userRef=fb.doc(fb.db,"users",user.uid), tagRef=fb.doc(fb.db,"playerTags",tag);
            const [userSnap,tagSnap]=await Promise.all([transaction.get(userRef),transaction.get(tagRef)]);
            if(userSnap.exists())return {uid:user.uid,...userSnap.data()};
            if(tagSnap.exists()){const error=new Error("PLAYER_TAG_TAKEN");error.code="PLAYER_TAG_TAKEN";throw error;}
            const publicProfile={uid:user.uid,displayName:name,tag,publicId,createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp(),lastLoginAt:fb.serverTimestamp(),bannerId:"",backgroundId:"default",titleId:"rookie",unlockedBackgroundIds:[...DEFAULT_BACKGROUND_IDS],unlockedTitleIds:[...DEFAULT_TITLE_IDS]};
            transaction.set(tagRef,{uid:user.uid,tag,displayName:name,publicId,createdAt:fb.serverTimestamp()});
            transaction.set(userRef,publicProfile);return {...publicProfile,createdAt:Date.now()};
          });
          state.socialProfile=profile;return profile;
        }catch(error){if(error?.code!=="PLAYER_TAG_TAKEN"&&error?.message!=="PLAYER_TAG_TAKEN")throw error;}
      }
      throw new Error("プレイヤーIDの作成に失敗しました。もう一度お試しください。");
    }
    async function loadSocialProfile(user=window.WaribashiFirebase?.authUser){
      const loadToken=(state.socialAuthLoadToken||0)+1;state.socialAuthLoadToken=loadToken;
      cleanupSocialListeners();
      if(!isFormalAccount(user)){state.socialProfile=null;renderSocialAccountUi();return null;}
      const fb=firebaseApi();if(!fb)return null;
      const snap=await fb.getDoc(fb.doc(fb.db,"users",user.uid));
      if(loadToken!==state.socialAuthLoadToken)return null;
      if(!snap.exists()){state.socialProfile=null;renderSocialAccountUi();socialOpen("profileSetupModal");return null;}
      const storedProfile={uid:user.uid,...snap.data()};
      state.socialProfile=normalizedPlayerCardProfile(storedProfile);
      renderSocialAccountUi();subscribeSocialData();repairOwnRoomStateOnStartup().catch(()=>{});
      const migration={...canonicalProfileMigration(storedProfile),lastLoginAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()};
      try{
        await fb.setDoc(fb.doc(fb.db,"users",user.uid),migration,{merge:true});
      }catch(error){
        // Auth and profile reads succeeded; optional bookkeeping must not leave
        // the account UI in a permanent loading state.
        console.warn("[Social] profile bookkeeping",error?.code,error?.message);
      }
      return state.socialProfile;
    }
    function authProviderLabel(user){
      const ids=(user?.providerData||[]).map(item=>item.providerId);
      if(ids.includes("google.com"))return "Google";if(ids.includes("password"))return "メールアドレス";return user?.isAnonymous?"ゲスト":"アカウント";
    }
    function renderSocialAccountUi(){
      const user=window.WaribashiFirebase?.authUser, formal=isFormalAccount(user), profile=state.socialProfile;
      if(socialEl("accountLoading"))socialEl("accountLoading").hidden=!!user;
      if(socialEl("loginOpenBtn"))socialEl("loginOpenBtn").hidden=!user||formal;
      if(socialEl("accountOpenBtn"))socialEl("accountOpenBtn").hidden=!formal;
      if(socialEl("socialFriendsOpenBtn"))socialEl("socialFriendsOpenBtn").hidden=!formal||!profile;
      if(profile){state.socialProfile=normalizedPlayerCardProfile(profile);socialEl("accountPublicId").textContent=profile.publicId;socialEl("accountDisplayName").textContent=profile.displayName;applyPlayerCardElement(socialEl("accountPlayerCardPreview"),state.socialProfile,{nameElement:socialEl("accountPlayerCardName")});}
      if(socialEl("accountProvider"))socialEl("accountProvider").textContent=authProviderLabel(user);
      if(socialEl("accountCreatedAt"))socialEl("accountCreatedAt").textContent=profile?.createdAt?new Date(socialTimestampMillis(profile.createdAt)).toLocaleDateString("ja-JP"):"-";
      for(const id of ["playerCardEditBtn","playerNameChangeBtn"]){const button=socialEl(id);if(button){button.disabled=false;button.setAttribute("aria-disabled",state.friendRoomId?"true":"false");button.title=state.friendRoomId?"対戦ルームに参加している間は変更できません。":"";}}
      ["authRememberCheckbox","registerRememberCheckbox","accountRememberCheckbox"].forEach(id=>{const input=socialEl(id);if(input)input.checked=authPersistenceEnabled();});
      renderSocialLists();
    }
    async function ensureProfileChangeAllowed(){
      const fb=firebaseApi();if(!fb||!state.socialProfile||!isFormalAccount(fb.authUser))throw new Error("正式アカウントへログインしてください。");
      let record=await getActiveRoomRecord();if(record&&await cleanupActiveRoomRecordIfStale(record))record=null;
      if(record||state.friendRoomId)throw new Error("対戦ルームに参加している間は変更できません。");
      return fb;
    }
    function showProfileActionError(error){
      const text=error?.code==="permission-denied"?"プロフィール状態を確認できませんでした。再読み込みしてください。":String(error?.message||"プロフィールを変更できませんでした。");
      const target=socialEl("accountMessage");socialMessage("accountMessage",text);target?.classList.add("social-error");target?.scrollIntoView?.({block:"nearest"});
    }
    function renderPlayerCardDraft(){
      const draft=state.playerCardDraft;if(!draft)return;
      applyPlayerCardElement(socialEl("playerCardEditorPreview"),{...state.socialProfile,...draft},{nameElement:socialEl("playerCardEditorName")});
      socialEl("playerCardBackgroundChoices")?.querySelectorAll("[data-background-id]").forEach(button=>button.classList.toggle("selected",button.dataset.backgroundId===draft.backgroundId));
      if(socialEl("playerCardTitleSelect"))socialEl("playerCardTitleSelect").value=draft.titleId;
    }
    async function openPlayerCardEditor(){
      await ensureProfileChangeAllowed();const profile=normalizedPlayerCardProfile(state.socialProfile);state.playerCardDraft={backgroundId:profile.backgroundId,titleId:profile.titleId};
      const choices=socialEl("playerCardBackgroundChoices");choices.replaceChildren();for(const id of profile.unlockedBackgroundIds){const def=PLAYER_CARD_BACKGROUNDS[id];if(!def)continue;const button=document.createElement("button");button.type="button";button.className="player-card-choice";button.dataset.backgroundId=id;button.textContent=def.label;button.addEventListener("click",()=>{state.playerCardDraft.backgroundId=id;renderPlayerCardDraft();});choices.append(button);}
      const select=socialEl("playerCardTitleSelect");select.replaceChildren();for(const id of profile.unlockedTitleIds){const def=PLAYER_TITLES[id];if(!def)continue;const option=document.createElement("option");option.value=id;option.textContent=def.label;select.append(option);}socialMessage("playerCardEditorMessage","");renderPlayerCardDraft();openAccountChildModal("playerCardEditorModal");
    }
    function closePlayerCardEditor(){state.playerCardDraft=null;closeAccountChildModal("playerCardEditorModal");}
    async function savePlayerCard(){
      const fb=await ensureProfileChangeAllowed(),profile=normalizedPlayerCardProfile(state.socialProfile),draft=state.playerCardDraft;if(!draft)throw new Error("編集内容がありません。");
      if(!profile.unlockedBackgroundIds.includes(draft.backgroundId)||!PLAYER_CARD_BACKGROUNDS[draft.backgroundId])throw new Error("所有していない背景は選択できません。");
      if(!profile.unlockedTitleIds.includes(draft.titleId)||!PLAYER_TITLES[draft.titleId])throw new Error("所有していない称号は選択できません。");
      await fb.updateDoc(fb.doc(fb.db,"users",profile.uid),{backgroundId:draft.backgroundId,bannerId:draft.backgroundId,titleId:draft.titleId,updatedAt:fb.serverTimestamp()});
      state.socialProfile=normalizedPlayerCardProfile({...profile,...draft,bannerId:draft.backgroundId});closePlayerCardEditor();renderSocialAccountUi();socialMessage("accountMessage","プレイヤーカードを保存しました。");
    }
    function openPlayerNameEditor(){socialEl("playerNameCurrent").textContent=state.socialProfile?.displayName||"-";socialEl("playerNameInput").value=state.socialProfile?.displayName||"";socialMessage("playerNameMessage","");openAccountChildModal("playerNameModal");}
    async function changePlayerName(){
      const fb=await ensureProfileChangeAllowed(),profile=state.socialProfile,name=validatePlayerName(socialEl("playerNameInput").value),publicId=`${name}#${profile.tag}`;
      const friendsSnap=await fb.getDocs(fb.collection(fb.db,"users",profile.uid,"friends")),friends=docsFromSnapshot(friendsSnap),batch=fb.writeBatch(fb.db);
      batch.update(fb.doc(fb.db,"users",profile.uid),{displayName:name,publicId,updatedAt:fb.serverTimestamp()});
      batch.update(fb.doc(fb.db,"playerTags",profile.tag),{displayName:name,publicId,updatedAt:fb.serverTimestamp()});
      for(const friend of friends)batch.update(fb.doc(fb.db,"users",friend.uid,"friends",profile.uid),{displayName:name,publicId});
      await batch.commit();state.socialProfile={...profile,displayName:name,publicId};closeAccountChildModal("playerNameModal");socialMessage("accountMessage","プレイヤー名を変更しました。");
    }
    function normalizeGiftCode(value){return String(value||"").normalize("NFKC").trim().toUpperCase();}
    async function claimGiftCode(){
      const fb=firebaseApi(),profile=state.socialProfile;if(!fb||!profile||!isFormalAccount(fb.authUser))throw new Error("正式アカウントでログインしてください。");const code=normalizeGiftCode(socialEl("giftCodeInput").value);if(!code)throw new Error("コードを入力してください。");
      const result=await fb.runTransaction(fb.db,async transaction=>{const codeRef=fb.doc(fb.db,"giftCodes",code),claimRef=fb.doc(fb.db,"giftCodes",code,"claims",profile.uid),userRef=fb.doc(fb.db,"users",profile.uid);const [codeSnap,claimSnap,userSnap]=await Promise.all([transaction.get(codeRef),transaction.get(claimRef),transaction.get(userRef)]);if(!codeSnap.exists())throw new Error("コードが見つかりません。");const gift=codeSnap.data();if(gift.active!==true)throw new Error("このコードは現在使用できません。");if(gift.expiresAt&&socialTimestampMillis(gift.expiresAt)<=Date.now())throw new Error("このコードの有効期限は終了しました。");if(claimSnap.exists())throw new Error("このコードはすでに受け取っています。");const max=gift.type==="single"?1:Number(gift.maxUses||0);if(["limited","single"].includes(gift.type)&&Number(gift.usedCount||0)>=max)throw new Error("このコードの配布は終了しました。");const user=normalizedPlayerCardProfile(userSnap.data()||profile),rewards=gift.rewards||{},titles=[...new Set([...user.unlockedTitleIds,...(rewards.titleIds||[]).filter(id=>PLAYER_TITLES[id])])],backgrounds=[...new Set([...user.unlockedBackgroundIds,...(rewards.backgroundIds||[]).filter(id=>PLAYER_CARD_BACKGROUNDS[id])])];transaction.update(userRef,{unlockedTitleIds:titles,unlockedBackgroundIds:backgrounds,updatedAt:fb.serverTimestamp()});transaction.set(claimRef,{uid:profile.uid,code,claimedAt:fb.serverTimestamp(),rewardsSnapshot:{titleIds:[...(rewards.titleIds||[])],backgroundIds:[...(rewards.backgroundIds||[])]}});if(["limited","single"].includes(gift.type))transaction.update(codeRef,{usedCount:Number(gift.usedCount||0)+1});return {titles,backgrounds,rewards};});
      state.socialProfile=normalizedPlayerCardProfile({...profile,unlockedTitleIds:result.titles,unlockedBackgroundIds:result.backgrounds});socialMessage("giftCodeMessage",`報酬を受け取りました：${(result.rewards.titleIds||[]).map(id=>PLAYER_TITLES[id]?.label).filter(Boolean).concat((result.rewards.backgroundIds||[]).map(id=>PLAYER_CARD_BACKGROUNDS[id]?.label).filter(Boolean)).join(" / ")}`);renderSocialAccountUi();
    }
    async function loginWithGoogle(register=false){
      const fb=window.WaribashiFirebase;if(!fb?.auth)throw new Error("認証を準備しています。");
      await applyAuthPersistence(selectedLoginPersistence(register));
      const provider=new fb.GoogleAuthProvider();let result;
      try{result=fb.auth.currentUser?.isAnonymous?await fb.linkWithPopup(fb.auth.currentUser,provider):await fb.signInWithPopup(fb.auth,provider);}
      catch(error){
        const credential=error?.credential||fb.GoogleAuthProvider.credentialFromError?.(error);
        if(["auth/credential-already-in-use","auth/account-exists-with-different-credential"].includes(error?.code)&&credential)result=await fb.signInWithCredential(fb.auth,credential);else throw error;
      }
      socialClose("authModal");await loadSocialProfile(result.user);return result.user;
    }
    async function registerWithEmail(){
      const fb=window.WaribashiFirebase, name=validatePlayerName(socialEl("registerNameInput").value);
      const email=socialEl("registerEmailInput").value.trim(),password=socialEl("registerPasswordInput").value,confirmation=socialEl("registerPasswordConfirmInput").value;
      if(password!==confirmation)throw new Error("確認用パスワードが一致しません。");
      await applyAuthPersistence(selectedLoginPersistence(true));
      const credential=fb.EmailAuthProvider.credential(email,password);
      const result=fb.auth.currentUser?.isAnonymous?await fb.linkWithCredential(fb.auth.currentUser,credential):await fb.signInWithCredential(fb.auth,credential);
      await createSocialProfile(name,result.user);socialClose("authModal");renderSocialAccountUi();subscribeSocialData();
    }
    async function searchPlayerByPublicId(publicId){
      const fb=firebaseApi();if(!fb||!state.socialProfile)throw new Error("アカウントへログインしてください。");
      const input=String(publicId||"").normalize("NFKC").trim();if(!/^.+#[0-9]{5}$/u.test(input))throw new Error("プレイヤーIDを 名前#5桁 で入力してください。");
      const tag=input.slice(-5),reservation=await fb.getDoc(fb.doc(fb.db,"playerTags",tag));if(!reservation.exists())return null;
      const data=reservation.data();if(normalizePublicId(data.publicId)!==normalizePublicId(input))return null;
      const snap=await fb.getDoc(fb.doc(fb.db,"users",data.uid));return snap.exists()?{uid:data.uid,...snap.data()}:null;
    }
    async function isBlockedByMe(targetUid){
      const fb=firebaseApi(),me=state.socialProfile;if(!fb||!me)return false;
      return (await fb.getDoc(fb.doc(fb.db,"users",me.uid,"blocked",targetUid))).exists();
    }
    async function findDirectedSocialRecords(collectionName,fromUid,toUid){
      const fb=firebaseApi();
      const constrained=fb.query(fb.collection(fb.db,collectionName),fb.where("fromUid","==",fromUid),fb.where("toUid","==",toUid));
      return docsFromSnapshot(await fb.getDocs(constrained));
    }
    async function sendFriendRequest(target){
      const fb=firebaseApi(),me=state.socialProfile;if(!me||!target)throw new Error("プレイヤーが見つかりません。");
      if(me.uid===target.uid)throw new Error("自分自身へ申請は送れません。");
      if(await isBlockedByMe(target.uid))throw new Error("このプレイヤーには現在申請できません。");
      if(state.socialFriends.some(item=>item.uid===target.uid))throw new Error("すでにフレンドです。");
      const sameRef=fb.doc(fb.db,"friendRequests",socialRequestId(me.uid,target.uid));
      const [same,reverse]=await Promise.all([findDirectedSocialRecords("friendRequests",me.uid,target.uid),findDirectedSocialRecords("friendRequests",target.uid,me.uid)]);
      if(same.some(item=>item.status==="pending"))throw new Error("すでにフレンド申請を送っています。");
      if(reverse.some(item=>item.status==="pending"))throw new Error("このプレイヤーからフレンド申請が届いています。申請タブから承認してください。");
      await fb.setDoc(sameRef,{fromUid:me.uid,toUid:target.uid,fromPublicId:me.publicId,toPublicId:target.publicId,fromDisplayName:me.displayName,toDisplayName:target.displayName,status:"pending",createdAt:fb.serverTimestamp()});
    }
    async function acceptFriendRequest(request){
      const fb=firebaseApi(),me=state.socialProfile;if(!me||request.toUid!==me.uid)throw new Error("申請を承認できません。");
      if(await isBlockedByMe(request.fromUid))throw new Error("このフレンド申請は利用できません。");
      const batch=fb.writeBatch(fb.db);
      batch.set(fb.doc(fb.db,"users",me.uid,"friends",request.fromUid),{uid:request.fromUid,publicId:request.fromPublicId,displayName:request.fromDisplayName,createdAt:fb.serverTimestamp()});
      batch.set(fb.doc(fb.db,"users",request.fromUid,"friends",me.uid),{uid:me.uid,publicId:me.publicId,displayName:me.displayName,createdAt:fb.serverTimestamp()});
      batch.delete(fb.doc(fb.db,"friendRequests",socialRequestId(request.fromUid,me.uid)));await batch.commit();
    }
    async function rejectFriendRequest(request){const fb=firebaseApi();await fb.deleteDoc(fb.doc(fb.db,"friendRequests",socialRequestId(request.fromUid,request.toUid)));}
    async function removeSocialFriend(target){
      const fb=firebaseApi(),me=state.socialProfile,batch=fb.writeBatch(fb.db);batch.delete(fb.doc(fb.db,"users",me.uid,"friends",target.uid));batch.delete(fb.doc(fb.db,"users",target.uid,"friends",me.uid));await batch.commit();
    }
    async function blockSocialPlayer(target){
      const fb=firebaseApi(),me=state.socialProfile,batch=fb.writeBatch(fb.db);
      batch.set(fb.doc(fb.db,"users",me.uid,"blocked",target.uid),{uid:target.uid,publicId:target.publicId,displayName:target.displayName,createdAt:fb.serverTimestamp()});
      [["users",me.uid,"friends",target.uid],["users",target.uid,"friends",me.uid],["friendRequests",socialRequestId(me.uid,target.uid)],["friendRequests",socialRequestId(target.uid,me.uid)],["battleInvites",socialRequestId(me.uid,target.uid)],["battleInvites",socialRequestId(target.uid,me.uid)]].forEach(path=>batch.delete(fb.doc(fb.db,...path)));await batch.commit();
    }
    function docsFromSnapshot(snapshot){return snapshot.docs.map(docSnap=>({id:docSnap.id,...docSnap.data()}));}
    function subscribeSocialData(){
      cleanupSocialListeners();const fb=firebaseApi(),me=state.socialProfile;if(!fb||!me)return;
      state.socialIncomingRequestsError=false;state.socialOutgoingRequestsError=false;
      const watch=(ref,callback,onError)=>state.socialListenerUnsubs.push(fb.onSnapshot(ref,snap=>{callback(docsFromSnapshot(snap));renderSocialLists();},error=>{console.error("[Social] listener",error?.code,error?.message);onError?.();renderSocialLists();}));
      watch(fb.collection(fb.db,"users",me.uid,"friends"),items=>state.socialFriends=items);
      watch(fb.query(fb.collection(fb.db,"friendRequests"),fb.where("toUid","==",me.uid)),items=>{state.socialIncomingRequestsError=false;state.socialIncomingRequests=items.filter(item=>item.status==="pending");},()=>state.socialIncomingRequestsError=true);
      watch(fb.query(fb.collection(fb.db,"friendRequests"),fb.where("fromUid","==",me.uid)),items=>{state.socialOutgoingRequestsError=false;state.socialOutgoingRequests=items.filter(item=>item.status==="pending");},()=>state.socialOutgoingRequestsError=true);
      const incoming=fb.query(fb.collection(fb.db,"battleInvites"),fb.where("toUid","==",me.uid));
      const outgoing=fb.query(fb.collection(fb.db,"battleInvites"),fb.where("fromUid","==",me.uid));
      state.socialInviteUnsubs.push(fb.onSnapshot(incoming,snap=>handleIncomingBattleInvites(docsFromSnapshot(snap)),error=>{console.error("[Invite] incoming",error?.code,error?.message);socialMessage("socialMessage","対戦招待の取得に失敗しました。");}));
      state.socialInviteUnsubs.push(fb.onSnapshot(outgoing,snap=>handleOutgoingBattleInvites(docsFromSnapshot(snap)),error=>{console.error("[Invite] outgoing",error?.code,error?.message);socialMessage("socialMessage","送信した対戦招待の取得に失敗しました。");}));
    }
    function socialListRow(label,buttons){return `<div class="social-list-item"><span class="social-id">${escapeHtml(label)}</span><span class="social-list-actions">${buttons}</span></div>`;}
    function renderSocialLists(){
      const badge=state.socialIncomingRequests.length;if(socialEl("socialRequestBadge")){socialEl("socialRequestBadge").hidden=!badge;socialEl("socialRequestBadge").textContent=String(badge);}if(socialEl("requestTabCount"))socialEl("requestTabCount").textContent=badge?`(${badge})`:"";
      if(socialEl("socialFriendsList"))socialEl("socialFriendsList").innerHTML=state.socialFriends.length?state.socialFriends.map(item=>socialListRow(item.displayName,`<button data-social-profile="${item.uid}">詳細</button>`)).join(""):"<p>フレンドはいません。</p>";
      if(socialEl("incomingRequestsList"))socialEl("incomingRequestsList").innerHTML=state.socialIncomingRequestsError?"<p class=\"social-error\">フレンド申請の取得に失敗しました。</p>":state.socialIncomingRequests.length?state.socialIncomingRequests.map(item=>socialListRow(item.fromPublicId,`<button data-request-accept="${item.id}">承認</button><button class="secondary" data-request-reject="${item.id}">拒否</button>`)).join(""):"<p>受信申請はありません。</p>";
      if(socialEl("outgoingRequestsList"))socialEl("outgoingRequestsList").innerHTML=state.socialOutgoingRequestsError?"<p class=\"social-error\">送信中の申請を取得できませんでした。</p>":state.socialOutgoingRequests.length?state.socialOutgoingRequests.map(item=>socialListRow(item.toPublicId,"送信中")).join(""):"<p>送信中の申請はありません。</p>";
    }
    async function openSocialProfile(target){
      const fb=firebaseApi();let profile=target;
      if(fb&&target?.uid){try{const snap=await fb.getDoc(fb.doc(fb.db,"users",target.uid));if(snap.exists())profile={uid:target.uid,...snap.data()};}catch(error){console.warn("[Social] public profile decoration",error?.code,error?.message);}}
      profile=normalizedPlayerCardProfile(profile||{});state.socialCurrentProfile=profile;socialEl("publicProfileId").textContent=profile.publicId||"-";socialEl("publicProfileName").textContent=profile.displayName||"-";applyPlayerCardElement(socialEl("publicProfilePlayerCard"),profile,{nameElement:socialEl("publicProfileCardName")});
      const friend=state.socialFriends.some(item=>item.uid===profile.uid),self=profile.uid===state.socialProfile?.uid;socialEl("sendFriendRequestBtn").hidden=friend||self||!profile.publicId;socialEl("battleInviteBtn").hidden=!friend;socialEl("removeFriendBtn").hidden=!friend;socialOpen("publicProfileModal");return profile;
    }
    function requestSocialConfirmation(title,text,{okLabel="実行",cancelLabel="キャンセル"}={}){
      socialEl("socialConfirmTitle").textContent=title;socialEl("socialConfirmText").textContent=text;socialOpen("socialConfirmModal");
      return new Promise(resolve=>{const ok=socialEl("socialConfirmOkBtn"),cancel=socialEl("socialConfirmCancelBtn");ok.textContent=okLabel;cancel.textContent=cancelLabel;const finish=value=>{ok.removeEventListener("click",accept);cancel.removeEventListener("click",decline);ok.textContent="実行";cancel.textContent="キャンセル";socialClose("socialConfirmModal");resolve(value);};const accept=()=>finish(true),decline=()=>finish(false);ok.addEventListener("click",accept);cancel.addEventListener("click",decline);});
    }
    function requestSocialRoomChoice(title,text,{returnLabel="ルームへ戻る",continueLabel="退出して続行",cancelLabel="キャンセル"}={}){
      socialEl("socialConfirmTitle").textContent=title;socialEl("socialConfirmText").textContent=text;socialOpen("socialConfirmModal");
      return new Promise(resolve=>{const back=socialEl("socialConfirmReturnBtn"),proceed=socialEl("socialConfirmOkBtn"),cancel=socialEl("socialConfirmCancelBtn");back.hidden=false;back.textContent=returnLabel;proceed.textContent=continueLabel;cancel.textContent=cancelLabel;const finish=value=>{back.removeEventListener("click",restore);proceed.removeEventListener("click",leave);cancel.removeEventListener("click",decline);back.hidden=true;back.textContent="ルームへ戻る";proceed.textContent="実行";cancel.textContent="キャンセル";socialClose("socialConfirmModal");resolve(value);};const restore=()=>finish("return"),leave=()=>finish("continue"),decline=()=>finish("cancel");back.addEventListener("click",restore);proceed.addEventListener("click",leave);cancel.addEventListener("click",decline);});
    }
    function activeRoomRef(fb=firebaseApi()){return fb?fb.doc(fb.db,"activeRooms",fb.uid):null;}
    async function getActiveRoomRecord(){const fb=firebaseApi();if(!fb)return null;const snap=await fb.getDoc(activeRoomRef(fb));return snap.exists()?{id:snap.id,...snap.data()}:null;}
    async function repairOwnRoomStateOnStartup(){
      const fb=firebaseApi();if(!fb)return;
      try{
        const record=await getActiveRoomRecord();
        if(record){await cleanupActiveRoomRecordIfStale(record);return;}
        const legacy=await findLegacyOwnedPublicRooms();
        for(const room of legacy){try{await leaveRoomRecordForReplacement(room);}catch(error){console.warn("[FriendRoom] legacy orphan cleanup failed",error?.code,error?.message);}}
      }catch(error){console.warn("[FriendRoom] startup self repair failed",error?.code,error?.message);}
    }
    async function findLegacyOwnedPublicRooms(){const fb=firebaseApi();if(!fb)return [];try{const snap=await fb.getDocs(fb.query(fb.collection(fb.db,"publicRooms"),fb.where("creatorUid","==",fb.uid),fb.limit(10)));const rooms=[];for(const item of docsFromSnapshot(snap)){try{const roomSnap=await fb.getDoc(fb.doc(fb.db,"rooms",item.roomId));if(roomSnap.exists()){const data=roomSnap.data()||{};if(data.hostUid===fb.uid&&data.status!=="closed")rooms.push({roomId:item.roomId,role:"host",data});}}catch(_){}}return rooms;}catch(_){return [];}}
    async function hasAnyActiveRoom(){if(state.friendRoomId)return true;try{if(await getActiveRoomRecord())return true;return (await findLegacyOwnedPublicRooms()).length>0;}catch(_){return false;}}
    async function cleanupActiveRoomRecordIfStale(record){
      const fb=firebaseApi();if(!fb||!record?.roomId)return false;
      try{const roomSnap=await fb.getDoc(fb.doc(fb.db,"rooms",record.roomId));if(roomSnap.exists()){const data=roomSnap.data()||{};const stillParticipant=(record.role==="host"&&data.hostUid===fb.uid&&data.status!=="closed")||(record.role==="guest"&&data.guestUid===fb.uid&&data.guestJoined===true&&data.status!=="closed");if(stillParticipant)return false;}await fb.deleteDoc(activeRoomRef(fb));return true;}catch(error){
        // A non-participant cannot read a private room. The activeRooms delete
        // Rule independently proves staleness, so attempt that safe self-repair.
        if(error?.code==="permission-denied"){try{await fb.deleteDoc(activeRoomRef(fb));return true;}catch(_){}}
        return false;
      }
    }
    async function ensureCurrentRoomLoaded(){
      if(state.friendRoomId&&state.friendRole)return {roomId:state.friendRoomId,role:state.friendRole,data:state.friendRoomData||null,activeRecord:null};
      const fb=firebaseApi();if(!fb)return null;const record=await getActiveRoomRecord();if(record){if(await cleanupActiveRoomRecordIfStale(record))return null;const roomSnap=await fb.getDoc(fb.doc(fb.db,"rooms",record.roomId));if(roomSnap.exists())return {roomId:record.roomId,role:record.role,data:roomSnap.data()||null,activeRecord:record};}
      const legacy=await findLegacyOwnedPublicRooms();return legacy[0]||null;
    }
    async function leaveRoomRecordForReplacement(current){
      const fb=firebaseApi();if(!fb||!current?.roomId||!current?.role)return;
      const roomRef=fb.doc(fb.db,"rooms",current.roomId),activeRef=activeRoomRef(fb);
      if(current.role==="host"){
        // Close the room first, then clean the index documents. Keeping the close
        // separate avoids a single failed auxiliary delete leaving the old room alive.
        let data=current.data||{};
        await fb.runTransaction(fb.db,async transaction=>{
          const snap=await transaction.get(roomRef);
          if(!snap.exists())return;
          data=snap.data()||{};
          if(data.hostUid!==fb.uid)return;
          if(["starting","playing"].includes(data.status))throw Object.assign(new Error("ROOM_IN_MATCH"),{code:"ROOM_IN_MATCH"});
          if(data.status!=="closed")transaction.update(roomRef,{status:"closed",updatedAt:fb.serverTimestamp()});
        });
        const cleanup=[];
        if(data.visibility==="public")cleanup.push(fb.deleteDoc(fb.doc(fb.db,"publicRooms",current.roomId)));
        if(data.shortCode)cleanup.push(fb.deleteDoc(fb.doc(fb.db,"roomCodes",data.shortCode)));
        if(cleanup.length){const results=await Promise.allSettled(cleanup);for(const result of results)if(result.status==="rejected")console.warn("[FriendRoom] replacement cleanup failed",result.reason?.code,result.reason?.message);}
        // The active-room lock is critical. Only release it after the room is closed.
        await fb.deleteDoc(activeRef);
      }else{
        await fb.runTransaction(fb.db,async transaction=>{const snap=await transaction.get(roomRef);if(snap.exists()&&snap.data().guestUid===fb.uid){const data=snap.data()||{};if(data.status!=="lobby")throw Object.assign(new Error("ROOM_IN_MATCH"),{code:"ROOM_IN_MATCH"});const patch={status:"lobby",guestUid:null,guestJoined:false,guestReady:false,guestDeckCounts:null,guestClientId:null,guestLastSeen:null,members:{...(data.members||{}),slot1:null},updatedAt:fb.serverTimestamp()};transaction.update(roomRef,patch);if(data.visibility==="public")transaction.set(fb.doc(fb.db,"publicRooms",current.roomId),publicRoomMetadata(current.roomId,{...data,...patch},fb.serverTimestamp()));}transaction.delete(activeRef);});
      }
      if(state.friendRoomId===current.roomId)clearFriendRoomLocalState();
    }
    async function verifyRoomReplacementCleanup(roomId){
      const record=await getActiveRoomRecord();if(record?.roomId===roomId){if(!await cleanupActiveRoomRecordIfStale(record))throw Object.assign(new Error("ACTIVE_ROOM_EXISTS"),{code:"ACTIVE_ROOM_EXISTS"});}
      if(state.friendRoomId===roomId)clearFriendRoomLocalState();return true;
    }
    const ABANDONED_MATCH_AGE_MS=30*60*1000;
    function roomHeartbeatMs(data,role){return socialTimestampMillis(role==="host"?data?.guestLastSeen:data?.hostLastSeen);}
    function roomActivityMs(current){const data=current?.data||{};return Math.max(socialTimestampMillis(data.updatedAt),socialTimestampMillis(current?.activeRecord?.updatedAt));}
    function isAbandonedMatchRoom(current,now=Date.now()){const opponentSeen=roomHeartbeatMs(current?.data,current?.role),basis=opponentSeen||roomActivityMs(current);return ["starting","playing"].includes(current?.data?.status)&&basis>0&&now-basis>=ABANDONED_MATCH_AGE_MS;}
    function restoreFriendRoom(current){if(!current?.roomId)return false;setFriendRoomUi(current.roomId,current.role,current.data?.shortCode||null);state.friendRoomData=current.data||null;showScreen("friendLobby");updateFriendLobbyView(current.data||null);subscribeFriendRoom(current.roomId);return true;}
    async function discardAbandonedMatchRoom(current){
      const fb=firebaseApi();if(!fb||!current?.roomId)throw new Error("Firebaseの準備ができていません。");const roomRef=fb.doc(fb.db,"rooms",current.roomId);let data=current.data||{};
      await fb.runTransaction(fb.db,async transaction=>{const snap=await transaction.get(roomRef);if(!snap.exists())return;data=snap.data()||{};if(data.status==="closed")return;const live={...current,data};if(!isAbandonedMatchRoom(live))throw Object.assign(new Error("ROOM_IN_MATCH"),{code:"ROOM_IN_MATCH"});transaction.update(roomRef,{status:"closed",updatedAt:fb.serverTimestamp()});});
      const cleanup=[];if(data.visibility==="public")cleanup.push(fb.deleteDoc(fb.doc(fb.db,"publicRooms",current.roomId)));if(data.shortCode)cleanup.push(fb.deleteDoc(fb.doc(fb.db,"roomCodes",data.shortCode)));const results=await Promise.allSettled(cleanup);for(const result of results)if(result.status==="rejected"&&result.reason?.code!=="not-found")console.warn("[FriendRoom] stale cleanup failed",result.reason?.code,result.reason?.message);await fb.deleteDoc(activeRoomRef(fb));if(state.friendRoomId===current.roomId)clearFriendRoomLocalState();await verifyRoomReplacementCleanup(current.roomId);return true;
    }
    async function prepareCurrentRoomForAction(purpose="操作を続ける"){
      const current=await ensureCurrentRoomLoaded();if(!current){if(state.friendRoomId)clearFriendRoomLocalState();return true;}const status=current.data?.status||"lobby";
      if(["starting","playing"].includes(status)){
        if(isAbandonedMatchRoom(current)){const discard=await requestSocialConfirmation("古い対戦データが残っています。","30分以上更新がなく、相手の接続も確認できません。破棄して続行しますか？",{okLabel:"破棄する"});if(!discard)return false;await discardAbandonedMatchRoom(current);return true;}
        const restore=await requestSocialConfirmation("現在対戦中です。","対戦画面へ戻りますか？",{okLabel:"対戦へ戻る"});if(restore)restoreFriendRoom(current);return false;
      }
      const host=current.role==="host",choice=await requestSocialRoomChoice("現在、対戦ルームに参加しています。",host?`ルームへ戻るか、現在の対戦ルームを解散して${purpose}か選んでください。`:`ルームへ戻るか、現在の対戦ルームから退出して${purpose}か選んでください。`,{continueLabel:host?"解散して続行":"退出して続行"});
      if(choice==="return"){restoreFriendRoom(current);return false;}if(choice!=="continue")return false;await leaveRoomRecordForReplacement(current);await verifyRoomReplacementCleanup(current.roomId);if(host){const leftovers=await findLegacyOwnedPublicRooms();for(const room of leftovers){if(room.roomId!==current.roomId)await leaveRoomRecordForReplacement(room);}}return true;
    }
    async function confirmAndLeaveCurrentRoom(purpose="新しいルームを作成"){
      return prepareCurrentRoomForAction(purpose);
    }
    async function prepareProfileChange(action){
      if(!await prepareCurrentRoomForAction("プロフィール編集を続行する"))return false;await action();return true;
    }
    async function sendBattleInvite(target,regulationId="standard"){
      const fb=firebaseApi(),me=state.socialProfile;if(!state.socialFriends.some(item=>item.uid===target.uid))throw new Error("フレンドにのみ対戦を申し込めます。");
      if(await hasAnyActiveRoom())throw new Error("対戦ルームに参加している間はフレンド対戦を申し込めません。");
      const regulation=regulationSnapshot(regulationId);
      if(await isBlockedByMe(target.uid))throw new Error("このプレイヤーには現在対戦を申し込めません。");
      const forward=fb.doc(fb.db,"battleInvites",socialRequestId(me.uid,target.uid)),now=Date.now();
      const [same,reverse]=await Promise.all([findDirectedSocialRecords("battleInvites",me.uid,target.uid),findDirectedSocialRecords("battleInvites",target.uid,me.uid)]);
      if(same.some(item=>item.status==="pending"&&socialTimestampMillis(item.expiresAt)>now))throw new Error("すでに対戦招待を送っています。");
      if(reverse.some(item=>item.status==="pending"&&socialTimestampMillis(item.expiresAt)>now))throw new Error("このプレイヤーから対戦のお誘いが届いています。届いた招待から対戦してください。");
      for(const stale of [...same,...reverse].filter(item=>item.status!=="pending"||socialTimestampMillis(item.expiresAt)<=now))await fb.deleteDoc(fb.doc(fb.db,"battleInvites",stale.id));
      await fb.setDoc(forward,{fromUid:me.uid,toUid:target.uid,fromPublicId:me.publicId,toPublicId:target.publicId,fromDisplayName:me.displayName,toDisplayName:target.displayName,status:"pending",createdAt:fb.serverTimestamp(),expiresAt:fb.Timestamp.fromMillis(now+60000),roomId:null,roomReady:false,shortCode:null,roomCreatedAt:null,completedAt:null,regulationId:regulation.modeId,regulationVersion:regulation.modeVersion});
    }
    function hideBattleInviteToast(){socialClose("battleInviteToast");state.socialInviteToastId=null;if(state.socialInviteTimer)clearInterval(state.socialInviteTimer);state.socialInviteTimer=null;}
    function acceptedInviteHandoffAnchorMs(invite){return socialTimestampMillis(invite.roomReady?invite.roomCreatedAt:invite.acceptedAt)||socialTimestampMillis(invite.acceptedAt)||socialTimestampMillis(invite.createdAt);}
    function isActionableAcceptedInvite(invite){if(!invite||invite.status!=="accepted"||!invite.roomId)return false;if(state.friendRoomId===invite.roomId)return true;const anchor=acceptedInviteHandoffAnchorMs(invite);if(!anchor)return true;return Date.now()-anchor<=(invite.roomReady?60000:15000);}
    async function cleanupStaleBattleInvite(invite){const fb=firebaseApi();if(!fb||!invite?.id||state.socialInviteCleanupPending.has(invite.id)||state.friendRoomId===invite.roomId)return;state.socialInviteCleanupPending.add(invite.id);try{await fb.deleteDoc(fb.doc(fb.db,"battleInvites",invite.id));}catch(error){console.warn("[Invite] stale cleanup failed",error?.code,error?.message);}finally{state.socialInviteCleanupPending.delete(invite.id);}}
    function handleIncomingBattleInvites(invites){
      const now=Date.now(),accepted=invites.filter(item=>item.status==="accepted"&&item.roomId),activeAccepted=accepted.filter(isActionableAcceptedInvite);activeAccepted.forEach(handleAcceptedSocialInvite);accepted.filter(item=>!isActionableAcceptedInvite(item)).forEach(cleanupStaleBattleInvite);if(activeAccepted.some(item=>!state.socialHandledAcceptedInvites.has(item.id)))return;
      const invite=invites.find(item=>item.status==="pending"&&socialTimestampMillis(item.expiresAt)>now);if(!invite){hideBattleInviteToast();return;}
      const rule=regulationDefinition(invite.regulationId,invite.regulationVersion),senderName=invite.fromDisplayName||state.socialFriends.find(item=>item.uid===invite.fromUid)?.displayName||"フレンド";state.socialInviteToastId=invite.id;socialEl("battleInviteToastText").textContent=rule?`${senderName}が対戦を申し込んでいます\n${rule.name}`:`${senderName}から未対応ルールの対戦招待が届きました。`;socialEl("acceptBattleInviteBtn").disabled=!rule;socialEl("declineBattleInviteBtn").disabled=false;socialOpen("battleInviteToast");
      if(state.socialInviteTimer)clearInterval(state.socialInviteTimer);const tick=()=>{const remaining=Math.max(0,Math.ceil((socialTimestampMillis(invite.expiresAt)-Date.now())/1000));socialEl("battleInviteCountdown").textContent=`残り ${remaining} 秒`;if(!remaining)hideBattleInviteToast();};tick();state.socialInviteTimer=setInterval(tick,250);
    }
    function handleOutgoingBattleInvites(invites){const accepted=invites.filter(item=>item.status==="accepted"&&item.roomId);accepted.filter(isActionableAcceptedInvite).forEach(handleAcceptedSocialInvite);accepted.filter(item=>!isActionableAcceptedInvite(item)).forEach(cleanupStaleBattleInvite);}
    async function acceptBattleInvite(){
      const fb=firebaseApi(),id=state.socialInviteToastId;if(!id)return;const ref=fb.doc(fb.db,"battleInvites",id);
      const before=await fb.getDoc(ref);if(!before.exists())throw new Error("招待が見つかりません。");if(await isBlockedByMe(before.data().fromUid))throw new Error("この対戦招待は利用できません。");if(!regulationDefinition(before.data().regulationId,before.data().regulationVersion))throw new Error("この対戦ルールには現在対応していません。");
      if(await hasAnyActiveRoom()){const proceed=await confirmAndLeaveCurrentRoom("このフレンド対戦を受ける");if(!proceed)return;}
      const autoRoomRef=fb.doc(fb.collection(fb.db,"rooms"));
      await fb.runTransaction(fb.db,async transaction=>{const snap=await transaction.get(ref);if(!snap.exists())throw new Error("招待が見つかりません。");const data=snap.data();if(data.status!=="pending"||socialTimestampMillis(data.expiresAt)<=Date.now())throw new Error("招待の有効期限が切れています。");transaction.update(ref,{status:"accepted",acceptedAt:fb.serverTimestamp(),roomId:autoRoomRef.id,roomReady:false,shortCode:null,roomCreatedAt:null});});
      if(state.socialInviteTimer)clearInterval(state.socialInviteTimer);state.socialInviteTimer=null;socialEl("acceptBattleInviteBtn").disabled=true;socialEl("declineBattleInviteBtn").disabled=true;socialEl("battleInviteToastText").textContent="対戦ルームを準備中…";socialEl("battleInviteCountdown").textContent="";socialMessage("socialMessage","対戦ルームを準備中…");
    }
    async function renderBlockedPlayers(){
      const fb=firebaseApi(),me=state.socialProfile;if(!fb||!me)return;const snap=await fb.getDocs(fb.collection(fb.db,"users",me.uid,"blocked")),items=docsFromSnapshot(snap),list=socialEl("blockedList");
      list.hidden=false;list.innerHTML=items.length?items.map(item=>socialListRow(item.displayName,`<button class="secondary" data-unblock="${item.uid}">解除</button>`)).join(""):"<p class=\"social-empty\">ブロック中のプレイヤーはいません。</p>";
    }
    async function declineBattleInvite(){const fb=firebaseApi(),id=state.socialInviteToastId;if(!id)return;await fb.deleteDoc(fb.doc(fb.db,"battleInvites",id));hideBattleInviteToast();}
    function clearInviteHandoffTimer(inviteId){const timer=state.socialInviteHandoffTimers.get(inviteId);if(timer)clearTimeout(timer);state.socialInviteHandoffTimers.delete(inviteId);}
    function armInviteHandoffTimeout(invite){if(state.socialInviteHandoffTimers.has(invite.id)||invite.roomReady)return;const timer=setTimeout(()=>{state.socialInviteHandoffTimers.delete(invite.id);state.socialInviteHandoffExpired.add(invite.id);socialEl("battleInviteToastText").textContent="対戦ルームの作成に失敗しました。もう一度お試しください。";socialMessage("socialMessage","対戦ルームの作成に失敗しました。もう一度お試しください。");},10000);state.socialInviteHandoffTimers.set(invite.id,timer);}
    async function createAcceptedFriendInviteRoom(invite){
      const fb=firebaseApi();if(!fb||state.socialInviteCreatingRooms.has(invite.id)||state.socialHandledAcceptedInvites.has(invite.id))return;state.socialInviteCreatingRooms.add(invite.id);socialMessage("socialMessage","対戦ルームを作成中…");
      try{let existing=null;try{const snap=await fb.getDoc(fb.doc(fb.db,"rooms",invite.roomId));if(snap.exists()&&snap.data().hostUid===fb.uid)existing=snap.data();}catch(_){}if(existing){setFriendRoomUi(invite.roomId,"host",existing.shortCode);state.friendRoomData=existing;showScreen("friendLobby");subscribeFriendRoom(invite.roomId);}else await createFriendRoomWithId(invite.roomId,"対戦招待が承認されました。対戦準備をしてください。",fb.doc(fb.db,"rooms",invite.roomId),{visibility:"private",tags:[],regulationId:invite.regulationId||"standard"});let published=false,lastError;for(let attempt=0;attempt<3&&!published;attempt+=1){try{await fb.updateDoc(fb.doc(fb.db,"battleInvites",invite.id),{roomReady:true,shortCode:state.friendRoomShortCode,roomCreatedAt:fb.serverTimestamp()});published=true;}catch(error){lastError=error;if(attempt<2)await delay(250*(attempt+1));}}if(!published)throw lastError;state.socialHandledAcceptedInvites.add(invite.id);}catch(error){try{const roomRef=fb.doc(fb.db,"rooms",invite.roomId);await fb.runTransaction(fb.db,async transaction=>{const snap=await transaction.get(roomRef);if(!snap.exists()||snap.data().hostUid!==fb.uid)return;transaction.update(roomRef,{status:"closed",updatedAt:fb.serverTimestamp()});if(snap.data().shortCode)transaction.delete(fb.doc(fb.db,"roomCodes",snap.data().shortCode));});}catch(cleanupError){console.error("[Invite] orphan room cleanup failed",cleanupError?.code,cleanupError?.message);}try{await fb.updateDoc(fb.doc(fb.db,"battleInvites",invite.id),{status:"cancelled",respondedAt:fb.serverTimestamp()});}catch(updateError){console.error("[Invite] failure publish failed",updateError?.code,updateError?.message);}clearFriendRoomLocalState();socialMessage("socialMessage","対戦ルームの作成に失敗しました。");}finally{state.socialInviteCreatingRooms.delete(invite.id);}
    }
    async function finalizeAcceptedBattleInvite(invite){const fb=firebaseApi();if(!fb||!invite?.id)return;const ref=fb.doc(fb.db,"battleInvites",invite.id);let completed=false;try{await fb.updateDoc(ref,{status:"completed",completedAt:fb.serverTimestamp()});completed=true;}catch(error){console.warn("[Invite] completion update failed",error?.code,error?.message);}try{await fb.deleteDoc(ref);}catch(error){if(!completed)console.warn("[Invite] completion cleanup failed",error?.code,error?.message);}}
    async function joinAcceptedFriendInviteRoom(invite){
      const fb=firebaseApi();if(!fb||state.socialInviteJoiningRooms.has(invite.id)||state.socialHandledAcceptedInvites.has(invite.id)||state.socialInviteHandoffExpired.has(invite.id))return;if(state.friendRoomId===invite.roomId){state.socialHandledAcceptedInvites.add(invite.id);finalizeAcceptedBattleInvite(invite);return;}state.socialInviteJoiningRooms.add(invite.id);clearInviteHandoffTimer(invite.id);
      try{const joined=await joinFriendRoom(invite.roomId,{internalRoomId:true});if(!joined)throw new Error("ROOM_JOIN_FAILED");state.socialHandledAcceptedInvites.add(invite.id);hideBattleInviteToast();await finalizeAcceptedBattleInvite(invite);}catch(error){state.socialInviteHandoffExpired.add(invite.id);clearFriendRoomLocalState();socialEl("battleInviteToastText").textContent="対戦ルームへの接続に失敗しました。";socialMessage("socialMessage","対戦ルームへの接続に失敗しました。");}finally{state.socialInviteJoiningRooms.delete(invite.id);}
    }
    function handleAcceptedSocialInvite(invite){const fb=firebaseApi();if(!fb||state.friendMatchStarted||state.socialHandledAcceptedInvites.has(invite.id)||(state.friendRoomId&&state.friendRoomId!==invite.roomId))return;if(fb.uid===invite.fromUid){if(!invite.roomReady)createAcceptedFriendInviteRoom(invite);else if(state.friendRoomId===invite.roomId)state.socialHandledAcceptedInvites.add(invite.id);return;}if(invite.roomReady)joinAcceptedFriendInviteRoom(invite);else armInviteHandoffTimeout(invite);}


    function otherFriendRole(role = state.friendRole) {
      return role === "host" ? "guest" : "host";
    }

    function cloneJson(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function ensureOnlineStateMaps() {
      const pairDefaults = { human: 0, cpu: 0 };
      if (!state.pendingNoDraw || typeof state.pendingNoDraw !== "object") state.pendingNoDraw = { ...pairDefaults };
      if (!state.activeNoDraw || typeof state.activeNoDraw !== "object") state.activeNoDraw = { ...pairDefaults };
      if (!state.pendingAcceleration || typeof state.pendingAcceleration !== "object") state.pendingAcceleration = { ...pairDefaults };
      if (!state.activeAcceleration || typeof state.activeAcceleration !== "object") state.activeAcceleration = { ...pairDefaults };
      if (!state.extraActions || typeof state.extraActions !== "object") state.extraActions = { ...pairDefaults };
      if (!state.berserkerTurns || typeof state.berserkerTurns !== "object") state.berserkerTurns = { ...pairDefaults };
      if (!state.noSplit || typeof state.noSplit !== "object") state.noSplit = { human: false, cpu: false };
      if (!state.pendingTerminalEnd || typeof state.pendingTerminalEnd !== "object") state.pendingTerminalEnd = { human: false, cpu: false };
      if (!state.activeExtraAction || typeof state.activeExtraAction !== "object") state.activeExtraAction = { human: false, cpu: false };
      if (!state.pendingIntemperanceCardLock || typeof state.pendingIntemperanceCardLock !== "object") state.pendingIntemperanceCardLock = { human: false, cpu: false };
      if (!state.activeIntemperanceCardLock || typeof state.activeIntemperanceCardLock !== "object") state.activeIntemperanceCardLock = { human: false, cpu: false };
      if (!state.pendingCardUseLockSource || typeof state.pendingCardUseLockSource !== "object") state.pendingCardUseLockSource = { human: "", cpu: "" };
      if (!state.activeCardUseLockSource || typeof state.activeCardUseLockSource !== "object") state.activeCardUseLockSource = { human: "", cpu: "" };
      if (!state.judgmentPrisonTurns || typeof state.judgmentPrisonTurns !== "object") state.judgmentPrisonTurns = { human: 0, cpu: 0 };
      if (!state.pendingAppealExecution || typeof state.pendingAppealExecution !== "object") state.pendingAppealExecution = { human: 0, cpu: 0 };
      if (!state.personalTurnCount || typeof state.personalTurnCount !== "object") state.personalTurnCount = { human: 0, cpu: 0 };
      if (!state.pendingMagicalHeartDraw || typeof state.pendingMagicalHeartDraw !== "object") state.pendingMagicalHeartDraw = { human: 0, cpu: 0 };
      if (!state.magicalChantProgress || typeof state.magicalChantProgress !== "object") state.magicalChantProgress = { human: 0, cpu: 0 };
      if (!state.magicalChantCompleted || typeof state.magicalChantCompleted !== "object") state.magicalChantCompleted = { human: false, cpu: false };
      if (!state.pendingAdvanceNotice || typeof state.pendingAdvanceNotice !== "object") state.pendingAdvanceNotice = { human: [], cpu: [] };
      if (!state.activeDirectiveBlessing || typeof state.activeDirectiveBlessing !== "object") state.activeDirectiveBlessing = { human: 0, cpu: 0 };
      if (!state.directiveTotalClears) state.directiveTotalClears = { human: 0, cpu: 0 };
      if (!state.naturalFaithUses) state.naturalFaithUses = { human: 0, cpu: 0 };
      if (!state.divineProofUsed) state.divineProofUsed = { human: false, cpu: false };
      if (!state.pendingDeusVult) state.pendingDeusVult = { human: false, cpu: false };
      if (!state.pendingYellowWaspNeedle) state.pendingYellowWaspNeedle = { human:false,cpu:false };
      if (!state.pendingGungnirRecovery) state.pendingGungnirRecovery = { human:false,cpu:false };
      if (!state.pendingDirectiveHandAttackModifier) state.pendingDirectiveHandAttackModifier = { human:{L:0,R:0}, cpu:{L:0,R:0} };
      if (!state.pendingDirectiveNextAttackModifier) state.pendingDirectiveNextAttackModifier = { human:0,cpu:0 };
      if (!state.pendingDirectiveReformContinue) state.pendingDirectiveReformContinue = { human:false,cpu:false };
      if (!state.activeDirectiveReformContinue) state.activeDirectiveReformContinue = { human:false,cpu:false };
      if (!state.pendingDirectiveNoSplit) state.pendingDirectiveNoSplit = { human:false,cpu:false };
      if (!state.pendingDirectiveAnnihilation) state.pendingDirectiveAnnihilation = { human:false,cpu:false };
      if (!state.activeDirectiveAnnihilation) state.activeDirectiveAnnihilation = { human:false,cpu:false };
      if (!state.pendingDirectiveAttackLimitDelta) state.pendingDirectiveAttackLimitDelta = { human:0,cpu:0 };
      if (!state.pendingChargeStun || typeof state.pendingChargeStun !== "object") state.pendingChargeStun = { human: false, cpu: false };
      if (!state.pendingChargeStunSource || typeof state.pendingChargeStunSource !== "object") state.pendingChargeStunSource = { human: "", cpu: "" };
      if (!state.lightSpeedCircuitUsed || typeof state.lightSpeedCircuitUsed !== "object") state.lightSpeedCircuitUsed = { human: false, cpu: false };
      if (!state.costLimitNextTurn || typeof state.costLimitNextTurn !== "object") state.costLimitNextTurn = { human: null, cpu: null };
      if (!state.activeCostLimit || typeof state.activeCostLimit !== "object") state.activeCostLimit = { human: null, cpu: null };
      if (!state.firstTurnStarted || typeof state.firstTurnStarted !== "object") state.firstTurnStarted = { human: false, cpu: false };
      if (!state.pendingStartDrawSkip || typeof state.pendingStartDrawSkip !== "object") state.pendingStartDrawSkip = { human: false, cpu: false };
      if (!state.furiosoSkipPending || typeof state.furiosoSkipPending !== "object") state.furiosoSkipPending = { human: false, cpu: false };
      if (!state.furiosoSkipActive || typeof state.furiosoSkipActive !== "object") state.furiosoSkipActive = { human: false, cpu: false };
      if(!state.selectedTheme)state.selectedTheme={human:null,cpu:null};if(!state.performanceLevel)state.performanceLevel={human:0,cpu:0};if(!state.resonanceTriggeredThisTurn)state.resonanceTriggeredThisTurn={human:false,cpu:false};if(!state.usedRondoFamilies)state.usedRondoFamilies={human:[],cpu:[]};if(!state.usedRondoCards)state.usedRondoCards={human:[],cpu:[]};if(!state.pendingDrawLock)state.pendingDrawLock={human:false,cpu:false};if(!state.activeDrawLock)state.activeDrawLock={human:false,cpu:false};if(!state.pendingPrestoAttack)state.pendingPrestoAttack={human:false,cpu:false};if(!state.sforzandoTurnBonus)state.sforzandoTurnBonus={human:0,cpu:0};if(!state.pendingCanonHits)state.pendingCanonHits=[];if(!state.quarterRestPending)state.quarterRestPending={human:false,cpu:false};if(!state.quarterRestActive)state.quarterRestActive={human:false,cpu:false};if(!state.wholeRestPending)state.wholeRestPending={human:false,cpu:false};if(!state.wholeRestActive)state.wholeRestActive={human:false,cpu:false};
      if (!state.temp || typeof state.temp !== "object") state.temp = {};
      for (const player of ["human", "cpu"]) {
        if (!state.temp[player] || typeof state.temp[player] !== "object") {
          state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0, naturalFaithActive:false, opponentZeroedThisTurn:false, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
        }
        for (const key of ["pendingNoDraw", "activeNoDraw", "pendingAcceleration", "activeAcceleration", "extraActions", "berserkerTurns"]) {
          if (typeof state[key][player] !== "number" || Number.isNaN(state[key][player])) state[key][player] = 0;
        }
      }
    }

    function serializeFriendTraps(player) {
      const traps = cloneJson(state.traps[player]);
      if (!state.friendRole) return traps;
      for (const hand of ["L", "R"]) for (const slot of traps[hand] || []) {
        if (trapCardId(slot) !== "harpoon" || typeof slot !== "object") continue;
        slot.ownerSide = friendSideForLocalPlayer(slot.owner);
        delete slot.owner;
      }
      return traps;
    }

    function deserializeFriendTraps(rawTraps) {
      const traps = cloneJson(rawTraps || { L: [], R: [] });
      for (const hand of ["L", "R"]) for (const slot of traps[hand] || []) {
        if (trapCardId(slot) !== "harpoon" || typeof slot !== "object") continue;
        const canonicalOwner = slot.ownerSide || (["host", "guest"].includes(slot.owner) ? slot.owner : null);
        if (canonicalOwner) slot.owner = localPlayerForFriendSide(canonicalOwner);
        delete slot.ownerSide;
      }
      return traps;
    }

    function serializeFriendCanonHits() {
      const hits = cloneJson(state.pendingCanonHits || []);
      if (!state.friendRole) return hits;
      return hits.map(hit => {
        const canonical = {...hit, sourceSide:friendSideForLocalPlayer(hit.sourcePlayer), waitForSide:friendSideForLocalPlayer(hit.waitForPlayer), defenderSide:friendSideForLocalPlayer(hit.defender)};
        delete canonical.sourcePlayer; delete canonical.waitForPlayer; delete canonical.defender;
        return canonical;
      });
    }

    function deserializeFriendCanonHits(rawHits) {
      const hits = cloneJson(rawHits || []);
      if (!state.friendRole) return hits;
      return hits.map(hit => {
        const local = {...hit, sourcePlayer:localPlayerForFriendSide(hit.sourceSide)||hit.sourcePlayer, waitForPlayer:localPlayerForFriendSide(hit.waitForSide)||hit.waitForPlayer, defender:localPlayerForFriendSide(hit.defenderSide)||hit.defender};
        delete local.sourceSide; delete local.waitForSide; delete local.defenderSide;
        return local;
      });
    }

    function serializeFriendSide(player) {
      ensureOnlineStateMaps();
      return {
        L: state[player].L,
        R: state[player].R,
        traps: serializeFriendTraps(player),
        deck: [...state.decks[player]],
        hand: [...state.hands[player]],
        discard: [...state.discard[player]],
        temp: cloneJson(state.temp[player]),
        noSplit: !!state.noSplit[player],
        extraActions: Number(state.extraActions[player] || 0),
        activeExtraAction: !!state.activeExtraAction[player],
        pendingAcceleration: Number(state.pendingAcceleration[player] || 0),
        activeAcceleration: Number(state.activeAcceleration[player] || 0),
        pendingNoDraw: Number(state.pendingNoDraw?.[player] || 0),
        activeNoDraw: Number(state.activeNoDraw?.[player] || 0),
        pendingTerminalEnd: !!state.pendingTerminalEnd[player],
        pendingIntemperanceCardLock: !!state.pendingIntemperanceCardLock[player],
        activeIntemperanceCardLock: !!state.activeIntemperanceCardLock[player],
        pendingCardUseLockSource: state.pendingCardUseLockSource[player] || "",
        activeCardUseLockSource: state.activeCardUseLockSource[player] || "",
        judgmentPrisonTurns: Number(state.judgmentPrisonTurns?.[player] || 0),
        pendingAppealExecution: Number(state.pendingAppealExecution?.[player] || 0),
        personalTurnCount: Number(state.personalTurnCount?.[player] || 0),
        pendingMagicalHeartDraw: Number(state.pendingMagicalHeartDraw?.[player] || 0),
        magicalChantProgress: Number(state.magicalChantProgress?.[player] || 0),
        magicalChantCompleted: !!state.magicalChantCompleted?.[player],
        pendingAdvanceNotice: cloneJson(state.pendingAdvanceNotice?.[player] || []),
        activeDirectiveBlessing: Number(state.activeDirectiveBlessing?.[player]) || 0,
        directiveTotalClears:Number(state.directiveTotalClears?.[player]||0),naturalFaithUses:Number(state.naturalFaithUses?.[player]||0),divineProofUsed:!!state.divineProofUsed?.[player],pendingDeusVult:!!state.pendingDeusVult?.[player],pendingDirectiveDraw:Number(state.pendingDirectiveDraw?.[player]||0),pendingDirectiveNoDraw:Number(state.pendingDirectiveNoDraw?.[player]||0),pendingDirectiveBonusDraw:Number(state.pendingDirectiveBonusDraw?.[player]||0),lastDirectiveClearCount:Number(state.lastDirectiveClearCount?.[player]||0),pendingDirectiveHandAttackModifier:cloneJson(state.pendingDirectiveHandAttackModifier?.[player]||{L:0,R:0}),pendingDirectiveNextAttackModifier:Number(state.pendingDirectiveNextAttackModifier?.[player]||0),pendingDirectiveReformContinue:!!state.pendingDirectiveReformContinue?.[player],activeDirectiveReformContinue:!!state.activeDirectiveReformContinue?.[player],pendingDirectiveNoSplit:!!state.pendingDirectiveNoSplit?.[player],pendingDirectiveAnnihilation:!!state.pendingDirectiveAnnihilation?.[player],activeDirectiveAnnihilation:!!state.activeDirectiveAnnihilation?.[player],pendingDirectiveAttackLimitDelta:Number(state.pendingDirectiveAttackLimitDelta?.[player]||0),
        pendingChargeStun: !!state.pendingChargeStun?.[player],
        pendingChargeStunSource: String(state.pendingChargeStunSource?.[player] || ""),
        lightSpeedCircuitUsed: !!state.lightSpeedCircuitUsed?.[player],
        cheapBatteryDecay: Number(state.cheapBatteryDecay?.[player]) || 0,
        energyBarrier: Number(state.energyBarrier?.[player]) || 0,
        costLimitNextTurn: state.costLimitNextTurn[player] ?? null,
        activeCostLimit: state.activeCostLimit[player] ?? null,
        berserkerTurns: Number(state.berserkerTurns[player] || 0),
        firstTurnStarted: !!state.firstTurnStarted[player],
        pendingStartDrawSkip: !!state.pendingStartDrawSkip[player],
        pendingYellowWaspNeedle: !!state.pendingYellowWaspNeedle[player],
        pendingGungnirRecovery: !!state.pendingGungnirRecovery[player],
        handCardInstances: [...ensureHandCardInstances(player)],
        cardLocks: cloneJson(state.cardLocks?.[player]||[]),
        forcedCard: cloneJson(state.forcedCard?.[player]||null),
        nobleGasProtected: !!state.nobleGasProtected?.[player],
        pendingLateAttackBonus: Number(state.pendingLateAttackBonus?.[player]||0)
        ,selectedTheme: state.selectedTheme[player]||null, performanceLevel:getPerformanceLevel(player), resonanceTriggeredThisTurn:!!state.resonanceTriggeredThisTurn[player], usedRondoFamilies:[...(state.usedRondoFamilies[player]||[])], usedRondoCards:[...(state.usedRondoCards[player]||[])], pendingDrawLock:!!state.pendingDrawLock[player], activeDrawLock:!!state.activeDrawLock[player], pendingPrestoAttack:!!state.pendingPrestoAttack[player], sforzandoTurnBonus:Number(state.sforzandoTurnBonus[player]||0), quarterRestPending:!!state.quarterRestPending[player], quarterRestActive:!!state.quarterRestActive[player], wholeRestPending:!!state.wholeRestPending[player], wholeRestActive:!!state.wholeRestActive[player], pendingCanonHits:serializeFriendCanonHits(), furiosoSkipPending:!!state.furiosoSkipPending[player], furiosoSkipActive:!!state.furiosoSkipActive[player]
      };
    }

    function buildFriendCanonicalSnapshot() {
      const role = state.friendRole;
      if (!role) return null;
      const otherRole = otherFriendRole(role);
      const snapshot = {
        schemaVersion: 3,
        publisherSide: role,
        host: null,
        guest: null,
        turnSide: state.turn === "human" ? role : otherRole,
        startingPlayer: state.startingPlayer,
        startingPlayerDecided: !!state.startingPlayerDecided,
        turnNumber: state.turnNumber,
        turnSerial: Number(state.friendTurnSerial||0),
        turnOwner: state.friendTurnOwner||null,
        turnStarted: !!state.friendTurnStarted,
        turnStartAppliedSerial:Number(state.friendTurnStartAppliedSerial||0),
        gameOver: !!state.gameOver,
        result: state.matchResult ?? null,
        log: [...state.log],
        lastAction: state.lastAction ? cloneJson(state.lastAction) : null
      };
      snapshot[role] = serializeFriendSide("human");
      snapshot[otherRole] = serializeFriendSide("cpu");
      return snapshot;
    }

    async function claimFriendTurnStart({turnSerial,turnOwner}={}){
      if(state.battleMode!=="friend"||!state.friendRoomId||!state.friendRole||turnOwner!==state.friendRole)return false;
      const fb=firebaseApi();if(!fb)return false;const roomRef=fb.doc(fb.db,"rooms",state.friendRoomId);let claimed=false;const token=`${state.friendRole}-${turnSerial}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      await fb.runTransaction(fb.db,async transaction=>{
        const roomSnap=await transaction.get(roomRef);if(!roomSnap.exists())throw new Error("対戦ルームが見つかりません。");
        const match=roomSnap.data()?.match;if(!match||getFriendMatchId(match)!==state.friendMatchId)return;
        const currentSerial=Number(match.turnSerial||match.state?.turnSerial||1),currentOwner=match.turnOwner||match.state?.turnOwner||match.turnSide;
        if(currentSerial!==Number(turnSerial)||currentOwner!==state.friendRole||match.turnStarted===true)return;
        transaction.update(roomRef,{"match.turnStarted":true,"match.turnStartToken":token,"match.turnStartClaimedAt":fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});claimed=true;
      });
      if(claimed){state.friendTurnSerial=Number(turnSerial);state.friendTurnOwner=turnOwner;state.friendTurnStarted=true;state.friendTurnStartToken=token;state.friendTurnStartClaimedAtMs=Date.now();}
      return claimed;
    }

    async function claimAndStartFriendTurn({turnSerial,turnOwner}={}){
      const claimed=await claimFriendTurnStart({turnSerial,turnOwner});if(!claimed)return false;
      await executeClaimedFriendTurnStart({turnSerial,turnOwner,turnStartToken:state.friendTurnStartToken});return true;
    }

    async function executeClaimedFriendTurnStart({turnSerial,turnOwner,turnStartToken}={}){
      const baseline=buildFriendCanonicalSnapshot(),wasHydrated=state.friendSnapshotHydrated;
      state.friendTurnStartAtomicActive=true;
      state.friendTurnStartDeferredPublish=false;
      state.friendTurnStartPendingFx=[];
      state.friendTurnStartPendingInterruptWrites=[];
      state.friendTurnStartAtomicContext={matchId:state.friendMatchId,turnSerial:Number(turnSerial),turnOwner,turnStartToken};
      try{
        await startTurn("human",{friendTurnKey:`${turnSerial}:${turnOwner}`,friendTurnToken:turnStartToken,friendTurnSerial:Number(turnSerial)});
        const context=state.friendTurnStartAtomicContext,pendingFx=[...state.friendTurnStartPendingFx],pendingInterrupts=[...state.friendTurnStartPendingInterruptWrites],deferred=state.friendTurnStartDeferredPublish;
        clearFriendTurnStartAtomicState();
        try{
          for(const fx of pendingFx)await writeFriendFxNow(fx,context);
          for(const interrupt of pendingInterrupts){if(interrupt?.__clearInterruptId)await clearResolvedFriendInterruptNow(interrupt.__clearInterruptId,context);else await writeFriendInterruptNow(interrupt,context);}
          await fatigueFxQueue.catch(()=>{});
          if(deferred&&state.friendMatchId===context?.matchId)await publishFriendStateNow(context.matchId);
        }finally{forgetCommittedFriendTurnContext(context);}
      }catch(error){
        clearFriendTurnStartAtomicState();
        state.friendSnapshotHydrated=false;
        await applyFriendCanonicalSnapshot(baseline,0,{turnSerial,turnOwner,turnStarted:true,turnStartAppliedSerial:Number(baseline?.turnStartAppliedSerial||0),turnStartToken,turnStartClaimedAt:state.friendTurnStartClaimedAtMs});
        state.friendSnapshotHydrated=wasHydrated;
        throw error;
      }
    }

    function clearFriendTurnStartAtomicState(){
      state.friendTurnStartAtomicActive=false;
      state.friendTurnStartDeferredPublish=false;
      state.friendTurnStartPendingFx=[];
      state.friendTurnStartPendingInterruptWrites=[];
      state.friendTurnStartAtomicContext=null;
    }

    function friendTurnStartContextKey(context){return context?.matchId&&context?.turnSerial&&context?.turnStartToken?`${context.matchId}:${context.turnSerial}:${context.turnStartToken}`:"";}

    function committedFriendTurnContextMode(context){
      const serial=Number(context?.turnSerial||0),owner=context?.turnOwner;
      if(!serial||!owner)return "";
      if(Number(state.friendTurnSerial||0)===serial&&state.friendTurnOwner===owner&&state.friendTurnStarted===true&&state.friendTurnStartToken===context.turnStartToken&&Number(state.friendTurnStartAppliedSerial||0)===serial)return "stableApplied";
      if(Number(state.friendTurnSerial||0)===serial+1&&state.friendTurnOwner===otherFriendRole(owner)&&state.friendTurnStarted===false&&!state.friendTurnStartToken&&Number(state.friendTurnStartAppliedSerial||0)===serial)return "appliedAndHandoff";
      return "";
    }

    function rememberCommittedFriendTurnContext(context){
      const key=friendTurnStartContextKey(context),mode=committedFriendTurnContextMode(context);
      if(!key||!mode)return null;
      const record={matchId:context.matchId,turnSerial:Number(context.turnSerial),turnOwner:context.turnOwner,turnStartToken:context.turnStartToken,mode};
      state.friendTurnStartCommittedKeys.add(key);
      state.friendTurnStartCommittedContexts.set(key,record);
      while(state.friendTurnStartCommittedContexts.size>20){const oldest=state.friendTurnStartCommittedContexts.keys().next().value;state.friendTurnStartCommittedContexts.delete(oldest);state.friendTurnStartCommittedKeys.delete(oldest);}
      return record;
    }

    function forgetCommittedFriendTurnContext(context){
      const key=friendTurnStartContextKey(context);if(!key)return;
      state.friendTurnStartCommittedKeys.delete(key);state.friendTurnStartCommittedContexts.delete(key);
    }

    function canFlushCommittedTurnStartSideEffect(match,guard={}){
      if(getFriendMatchId(match)!==(guard.matchId||state.friendMatchId))return false;
      if(!guard.turnSerial)return true;
      const key=friendTurnStartContextKey(guard),record=key&&state.friendTurnStartCommittedContexts.get(key);
      if(!record||record.matchId!==guard.matchId||record.turnSerial!==Number(guard.turnSerial)||record.turnOwner!==guard.turnOwner||record.turnStartToken!==guard.turnStartToken)return false;
      const serial=record.turnSerial;
      if(record.mode==="stableApplied")return Number(match?.turnSerial||0)===serial&&match?.turnOwner===record.turnOwner&&match?.turnStarted===true&&Number(match?.turnStartAppliedSerial||0)===serial&&match?.turnStartToken===record.turnStartToken;
      if(record.mode==="appliedAndHandoff")return Number(match?.turnSerial||0)===serial+1&&match?.turnOwner===otherFriendRole(record.turnOwner)&&match?.turnStarted===false&&Number(match?.turnStartAppliedSerial||0)===serial&&match?.turnStartToken==null;
      return false;
    }

    function friendTimestampMillis(value){return typeof value?.toMillis==="function"?value.toMillis():Number(value||0);}

    async function claimFriendTurnStartRecovery({turnSerial,turnOwner}={}){
      if(state.battleMode!=="friend"||!state.friendRoomId||!state.friendRole||turnOwner!==state.friendRole)return false;
      const fb=firebaseApi();if(!fb)return false;const roomRef=fb.doc(fb.db,"rooms",state.friendRoomId);let claimed=false;const token=`${state.friendRole}-recovery-${turnSerial}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      await fb.runTransaction(fb.db,async transaction=>{
        const roomSnap=await transaction.get(roomRef);if(!roomSnap.exists())return;
        const match=roomSnap.data()?.match;if(!match||getFriendMatchId(match)!==state.friendMatchId)return;
        const serial=Number(match.turnSerial||0),owner=match.turnOwner,applied=Number(match.turnStartAppliedSerial||0),claimedAt=friendTimestampMillis(match.turnStartClaimedAt);
        if(serial!==Number(turnSerial)||owner!==state.friendRole||match.turnStarted!==true||applied>=serial||!claimedAt||Date.now()-claimedAt<5000)return;
        transaction.update(roomRef,{"match.turnStartToken":token,"match.turnStartClaimedAt":fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});claimed=true;
      });
      if(claimed){state.friendTurnStartToken=token;state.friendTurnStartClaimedAtMs=Date.now();}
      return claimed;
    }

    async function recoverAndStartFriendTurn({turnSerial,turnOwner}={}){
      const claimed=await claimFriendTurnStartRecovery({turnSerial,turnOwner});if(!claimed)return false;
      await executeClaimedFriendTurnStart({turnSerial,turnOwner,turnStartToken:state.friendTurnStartToken});return true;
    }

    function clearFriendTurnClaimRetry(){
      if(state.friendTurnClaimRetryTimer)clearTimeout(state.friendTurnClaimRetryTimer);
      state.friendTurnClaimRetryTimer=null;state.friendTurnClaimRetryKey="";state.friendTurnClaimRetryCount=0;
    }

    function scheduleFriendTurnClaimRetry(turnSerial,turnOwner,matchId,delayMs=250){
      const key=`${matchId}:${turnSerial}:${turnOwner}`;
      if(state.friendTurnClaimRetryKey!==key){clearFriendTurnClaimRetry();state.friendTurnClaimRetryKey=key;}
      if(state.friendTurnClaimRetryTimer||state.friendTurnClaimRetryCount>=2)return;
      state.friendTurnClaimRetryCount+=1;
      state.friendTurnClaimRetryTimer=setTimeout(()=>{
        state.friendTurnClaimRetryTimer=null;
        if(state.friendMatchId!==matchId||state.friendTurnSerial!==turnSerial||state.friendTurnOwner!==turnOwner||state.friendTurnStartAppliedSerial>=turnSerial)return;
        ensureFriendLocalTurnStarted({allowRetry:true}).catch(error=>console.error("[FriendRoom] turn retry failed",{turnSerial,turnOwner,code:error?.code,message:error?.message}));
      },Math.max(delayMs,250*state.friendTurnClaimRetryCount));
    }

    async function ensureFriendLocalTurnStarted({allowRetry=true}={}){
      if(state.battleMode!=="friend"||state.gameOver||!state.friendMatchStarted||state.friendTurnOwner!==state.friendRole)return false;
      const turnSerial=Number(state.friendTurnSerial||0),turnOwner=state.friendTurnOwner,matchId=state.friendMatchId;
      if(!turnSerial||!matchId||state.friendTurnClaimInFlight)return false;
      const turnKey=`${turnSerial}:${turnOwner}`;
      if(Number(state.friendTurnStartAppliedSerial||0)>=turnSerial){clearFriendTurnClaimRetry();return true;}
      state.friendTurnClaimInFlight=true;
      try{
        let started=false;
        if(!state.friendTurnStarted){
          started=await claimAndStartFriendTurn({turnSerial,turnOwner});
        }else{
          const leaseRemaining=Math.max(0,Number(state.friendTurnStartClaimedAtMs||0)+5000-Date.now());
          if(leaseRemaining>0){
            if(allowRetry)scheduleFriendTurnClaimRetry(turnSerial,turnOwner,matchId,leaseRemaining+100);
            return false;
          }
          started=await recoverAndStartFriendTurn({turnSerial,turnOwner});
        }
        if(started){clearFriendTurnClaimRetry();return true;}
        if(allowRetry&&state.friendMatchId===matchId&&state.friendTurnStartAppliedSerial<turnSerial)scheduleFriendTurnClaimRetry(turnSerial,turnOwner,matchId,500);
        return false;
      }catch(error){
        console.warn("[FriendRoom] turn claim failed",{turnSerial,turnOwner,localRole:state.friendRole,code:error?.code,message:error?.message});
        if(allowRetry&&state.friendMatchId===matchId&&state.friendTurnStartAppliedSerial<turnSerial)scheduleFriendTurnClaimRetry(turnSerial,turnOwner,matchId,500);
        return false;
      }finally{state.friendTurnClaimInFlight=false;}
    }

    function applyFriendSideToLocal(player, side, options = {}) {
      ensureOnlineStateMaps();
      if (!side) return;

      const preserveOwnerOnlyMeta = !!options.preserveOwnerOnlyMeta;
      const ownedLightSpeedCircuitUsed = !!state.lightSpeedCircuitUsed?.[player];
      const ownedPendingChargeStun = !!state.pendingChargeStun?.[player];
      const ownedPendingChargeStunSource = String(state.pendingChargeStunSource?.[player] || "");
      const ownedChargeCardsUsed = Array.isArray(state.temp?.[player]?.chargeCardsUsed)
        ? [...state.temp[player].chargeCardsUsed]
        : [];
      // 相手が公開したスナップショットは、自分の直前操作より古い場合がある。
      // カード使用権と同名禁止を古い値で上書きすると、使用済み状態が残り続けるため所有者側を優先する。
      const ownedCardActionUsed = !!state.temp?.[player]?.cardActionUsed;
      const ownedCardExtraUses = Number(state.temp?.[player]?.cardExtraUses || 0);
      const ownedTerminalCardBanIds = Array.isArray(state.temp?.[player]?.terminalCardBanIds)
        ? [...state.temp[player].terminalCardBanIds]
        : [];
      const ownedAttackLimit = Number(state.temp?.[player]?.attackLimit ?? 1);
      const ownedAttacksUsed = Number(state.temp?.[player]?.attacksUsed || 0);
      const ownedAttacksOccurredThisTurn = Number(state.temp?.[player]?.attacksOccurredThisTurn || 0);
      const ownedDirectiveActions = cloneJson(state.temp?.[player]?.directiveActions || { attacks: [], splitUsed: false, cardUsed: false });
      const ownedMultiAttackSource = state.temp?.[player]?.multiAttackSource ?? null;
      const ownedPersonalTurnCount = Number(state.personalTurnCount?.[player] || 0);
      const ownedCheapBatteryDecay = Number(state.cheapBatteryDecay?.[player]) || 0;
      const ownedEnergyBarrier = Number(state.energyBarrier?.[player]) || 0;
      state[player] = { L: Number(side.L ?? 0), R: Number(side.R ?? 0) };
      state.traps[player] = deserializeFriendTraps(side.traps);
      state.decks[player] = [...(side.deck || [])];
      state.hands[player] = [...(side.hand || [])];
      state.discard[player] = [...(side.discard || [])];
      state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ...(side.temp || {}) };
      if (preserveOwnerOnlyMeta) {
        state.temp[player].chargeCardsUsed = ownedChargeCardsUsed;
        state.temp[player].cardActionUsed = ownedCardActionUsed;
        state.temp[player].cardExtraUses = ownedCardExtraUses;
        state.temp[player].terminalCardBanIds = ownedTerminalCardBanIds;
        state.temp[player].attackLimit = ownedAttackLimit;
        state.temp[player].attacksUsed = ownedAttacksUsed;
        state.temp[player].attacksOccurredThisTurn = ownedAttacksOccurredThisTurn;
        state.temp[player].directiveActions = ownedDirectiveActions;
        state.temp[player].multiAttackSource = ownedMultiAttackSource;
      } else if (!Array.isArray(state.temp[player].chargeCardsUsed)) {
        state.temp[player].chargeCardsUsed = [];
      }
      state.noSplit[player] = !!side.noSplit;
      state.extraActions[player] = Number(side.extraActions || 0);
      state.activeExtraAction[player] = !!side.activeExtraAction;
      state.pendingAcceleration[player] = Number(side.pendingAcceleration || 0);
      state.activeAcceleration[player] = Number(side.activeAcceleration || 0);
      if (!state.pendingNoDraw) state.pendingNoDraw = { human: 0, cpu: 0 };
      if (!state.activeNoDraw) state.activeNoDraw = { human: 0, cpu: 0 };
      state.pendingNoDraw[player] = Number(side.pendingNoDraw || 0);
      state.activeNoDraw[player] = Number(side.activeNoDraw || 0);
      state.pendingStartDrawSkip[player] = !!side.pendingStartDrawSkip;
      state.pendingYellowWaspNeedle[player] = !!side.pendingYellowWaspNeedle;
      state.pendingGungnirRecovery[player] = !!side.pendingGungnirRecovery;
      state.furiosoSkipPending[player]=!!side.furiosoSkipPending;state.furiosoSkipActive[player]=!!side.furiosoSkipActive;
      state.handCardInstances[player]=Array.isArray(side.handCardInstances)?[...side.handCardInstances]:[];state.cardLocks[player]=cloneJson(side.cardLocks||[]);state.forcedCard[player]=cloneJson(side.forcedCard||null);state.nobleGasProtected[player]=!!side.nobleGasProtected;state.pendingLateAttackBonus[player]=Number(side.pendingLateAttackBonus||0);ensureHandCardInstances(player);
      state.selectedTheme[player]=side.selectedTheme||null;state.performanceLevel[player]=Math.max(0,Math.min(PERFORMANCE_MAX_LEVEL,Number(side.performanceLevel)||0));state.resonanceTriggeredThisTurn[player]=!!side.resonanceTriggeredThisTurn;state.usedRondoFamilies[player]=[...(side.usedRondoFamilies||[])];state.usedRondoCards[player]=[...(side.usedRondoCards||[])];state.pendingDrawLock[player]=!!side.pendingDrawLock;state.activeDrawLock[player]=!!side.activeDrawLock;state.pendingPrestoAttack[player]=!!side.pendingPrestoAttack;state.sforzandoTurnBonus[player]=Math.max(0,Number(side.sforzandoTurnBonus)||0);state.quarterRestPending[player]=!!side.quarterRestPending;state.quarterRestActive[player]=!!side.quarterRestActive;state.wholeRestPending[player]=!!side.wholeRestPending;state.wholeRestActive[player]=!!side.wholeRestActive;if(Array.isArray(side.pendingCanonHits))state.pendingCanonHits=deserializeFriendCanonHits(side.pendingCanonHits);
      state.pendingTerminalEnd[player] = !!side.pendingTerminalEnd;
      state.pendingIntemperanceCardLock[player] = !!side.pendingIntemperanceCardLock;
      state.activeIntemperanceCardLock[player] = !!side.activeIntemperanceCardLock;
      state.pendingCardUseLockSource[player] = side.pendingCardUseLockSource || "";
      state.activeCardUseLockSource[player] = side.activeCardUseLockSource || "";
      state.judgmentPrisonTurns[player] = Number(side.judgmentPrisonTurns || 0);
      state.pendingAppealExecution[player] = Number(side.pendingAppealExecution || 0);
      state.personalTurnCount[player] = preserveOwnerOnlyMeta ? ownedPersonalTurnCount : Number(side.personalTurnCount || 0);
      state.pendingMagicalHeartDraw[player] = Number(side.pendingMagicalHeartDraw || 0);
      state.magicalChantProgress[player] = Math.max(0, Math.min(3, Number(side.magicalChantProgress || 0)));
      state.magicalChantCompleted[player] = !!side.magicalChantCompleted;
      if (state.magicalChantCompleted[player]) transformMagicalChantCards(player);
      state.pendingAdvanceNotice[player] = cloneJson(side.pendingAdvanceNotice || []);
      state.activeDirectiveBlessing[player] = Number(side.activeDirectiveBlessing) || 0;
      state.directiveTotalClears[player]=Number(side.directiveTotalClears)||0;state.naturalFaithUses[player]=Number(side.naturalFaithUses)||0;state.divineProofUsed[player]=!!side.divineProofUsed;state.pendingDeusVult[player]=!!side.pendingDeusVult;state.pendingDirectiveDraw[player]=Number(side.pendingDirectiveDraw)||0;state.pendingDirectiveNoDraw[player]=Number(side.pendingDirectiveNoDraw)||0;state.pendingDirectiveBonusDraw[player]=Number(side.pendingDirectiveBonusDraw)||0;state.lastDirectiveClearCount[player]=Number(side.lastDirectiveClearCount)||0;state.pendingDirectiveHandAttackModifier[player]=cloneJson(side.pendingDirectiveHandAttackModifier||{L:0,R:0});state.pendingDirectiveNextAttackModifier[player]=Number(side.pendingDirectiveNextAttackModifier)||0;state.pendingDirectiveReformContinue[player]=!!side.pendingDirectiveReformContinue;state.activeDirectiveReformContinue[player]=!!side.activeDirectiveReformContinue;state.pendingDirectiveNoSplit[player]=!!side.pendingDirectiveNoSplit;state.pendingDirectiveAnnihilation[player]=!!side.pendingDirectiveAnnihilation;state.activeDirectiveAnnihilation[player]=!!side.activeDirectiveAnnihilation;state.pendingDirectiveAttackLimitDelta[player]=Number(side.pendingDirectiveAttackLimitDelta)||0;
      if (preserveOwnerOnlyMeta) {
        state.pendingChargeStun[player] = ownedPendingChargeStun;
        state.pendingChargeStunSource[player] = ownedPendingChargeStunSource;
        state.lightSpeedCircuitUsed[player] = ownedLightSpeedCircuitUsed;
        state.cheapBatteryDecay[player] = ownedCheapBatteryDecay;
        state.energyBarrier[player] = ownedEnergyBarrier;
      } else {
        state.pendingChargeStun[player] = !!side.pendingChargeStun;
        state.pendingChargeStunSource[player] = String(side.pendingChargeStunSource || "");
        state.lightSpeedCircuitUsed[player] = !!side.lightSpeedCircuitUsed;
        state.cheapBatteryDecay[player] = Number(side.cheapBatteryDecay) || 0;
        state.energyBarrier[player] = Number(side.energyBarrier) || 0;
      }
      state.costLimitNextTurn[player] = side.costLimitNextTurn ?? null;
      state.activeCostLimit[player] = side.activeCostLimit ?? null;
      state.berserkerTurns[player] = Number(side.berserkerTurns || 0);
      state.firstTurnStarted[player] = !!side.firstTurnStarted;
    }

    async function applyFriendCanonicalSnapshot(snapshot, revision = 0, matchMeta = null) {
      if (!snapshot || !state.friendRole) return;
      ensureOnlineStateMaps();
      if (state.friendPublishTimer) {
        clearTimeout(state.friendPublishTimer);
        state.friendPublishTimer = null;
      }
      if (revision && revision <= state.friendLastAppliedRevision) return;
      state.friendApplyingRemoteState = true;
      try {
        const publisherSide = snapshot.publisherSide || null;

        const incomingOwnerGeneration=Number(snapshot[state.friendRole]?.personalTurnCount||0);
        const localOwnerGeneration=Number(state.personalTurnCount?.human||0);
        // 初回join/reconnectはroomを正本にする。接続確立後だけ、相手publisherが持つ
        // 同一または旧turn generationから自分の行動権を巻き戻させない。
        const preserveLocalOwnerTurn=!!state.friendSnapshotHydrated&&publisherSide!==state.friendRole&&incomingOwnerGeneration<=localOwnerGeneration;
        applyFriendSideToLocal("human", snapshot[state.friendRole], {
          preserveOwnerOnlyMeta: preserveLocalOwnerTurn
        });
        applyFriendSideToLocal("cpu", snapshot[otherFriendRole()], {
          preserveOwnerOnlyMeta: publisherSide === state.friendRole
        });
        const authoritativeTurnOwner=matchMeta?.turnOwner||snapshot.turnOwner||snapshot.turnSide;
        state.turn = authoritativeTurnOwner === state.friendRole ? "human" : "cpu";
        if(snapshot.startingPlayer==="host"||snapshot.startingPlayer==="guest"){
          state.startingPlayer=snapshot.startingPlayer;
          state.startingPlayerDecided=true;
        }
        state.turnNumber = Number(snapshot.turnNumber || 1);
        state.friendTurnSerial=Number(matchMeta?.turnSerial||snapshot.turnSerial||state.friendTurnSerial||1);
        state.friendTurnOwner=matchMeta?.turnOwner||snapshot.turnOwner||snapshot.turnSide||state.friendTurnOwner;
        state.friendTurnStarted=typeof matchMeta?.turnStarted==="boolean"?matchMeta.turnStarted:snapshot.turnStarted===true;
        state.friendTurnStartAppliedSerial=Number(matchMeta?.turnStartAppliedSerial??snapshot.turnStartAppliedSerial??(state.friendTurnStarted?state.friendTurnSerial:Math.max(0,state.friendTurnSerial-1)));
        state.friendTurnStartToken=matchMeta?.turnStartToken||null;
        state.friendTurnStartClaimedAtMs=friendTimestampMillis(matchMeta?.turnStartClaimedAt);
        if(state.friendTurnStartAppliedSerial>=state.friendTurnSerial||state.friendTurnOwner!==state.friendRole)clearFriendTurnClaimRetry();
        state.gameOver = !!snapshot.gameOver;
        state.matchResult = snapshot.result ?? state.matchResult ?? null;
        state.matchResultReason = snapshot.resultReason ?? state.matchResultReason ?? null;
        state.surrenderedBy = snapshot.surrenderedBy ?? matchMeta?.surrenderedBy ?? state.surrenderedBy ?? null;
        state.friendSurrenderNoticeAcknowledged = matchMeta?.surrenderNoticeAcknowledged ?? state.friendSurrenderNoticeAcknowledged ?? null;
        state.log = [...(snapshot.log || [])];
        state.lastAction = snapshot.lastAction ? cloneJson(snapshot.lastAction) : null;
        state.friendLastAppliedRevision = Math.max(state.friendLastAppliedRevision, Number(revision || 0));
        state.friendSyncRevision = Math.max(state.friendSyncRevision, Number(revision || 0));
        state.mode = "attack";
        state.selectedAttackHand = null;
        state.selectedTrapCardIndex = null;
        state.pendingTrapTargetEffect = null;
        state.pendingRepairDiscard = null;
        state.pendingEqualTradeSelf = null;
        state.pendingRapidFireDiscard = null;
        state.pendingSwapFirst = null;
        elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
        clearHighlights();
        render();
        if (state.gameOver && state.matchResult) {
          applySyncedBattleResult(state.matchResult, state.matchResultReason, state.surrenderedBy, state.friendSurrenderNoticeAcknowledged, getFriendMatchId(matchMeta));
        }
      } finally {
        state.friendApplyingRemoteState = false;
      }

      if (!state.gameOver && state.turn === "human" && state.friendTurnStartAppliedSerial<state.friendTurnSerial) {
        const pendingAttackDeltaBeforeStart = Number(state.pendingDirectiveAttackLimitDelta?.human || 0);
        const turnBeforeStart = state.turn;
        await ensureFriendLocalTurnStarted();
        // remote apply終了後にstartTurnを実行する。連撃失敗のdelta消費や、
        // attackLimit=0による即時auto-endでstateが進んだ場合も必ずroomへ返す。
        if (pendingAttackDeltaBeforeStart !== Number(state.pendingDirectiveAttackLimitDelta?.human || 0) || turnBeforeStart !== state.turn) {
          await forcePublishFriendStateNow("directive combo penalty consumed");
        }
      } else if (!state.gameOver) {
        setMessage(state.turn === "human" ? "あなたの番です。" : "相手の番です。同期を待っています。");
        render();
      }
    }

    async function publishFriendStateNow(expectedMatchId=state.friendMatchId,options={}) {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || state.friendApplyingRemoteState) return;
      if(state.friendTurnStartAtomicActive&&!Number(options.applyTurnStartSerial||0)){state.friendTurnStartDeferredPublish=true;return;}
      if(!expectedMatchId||state.friendMatchId!==expectedMatchId)return;
      const fb = firebaseApi();
      if (!fb) return;
      const snapshot = buildFriendCanonicalSnapshot();
      if (!snapshot) return;
      const applySerial=Number(options.applyTurnStartSerial||0),applyToken=options.turnStartToken||null;
      const clearInterruptId=String(options.clearInterruptId||"");
      const signature = JSON.stringify(snapshot);
      if (!applySerial&&!clearInterruptId&&signature === state.friendLastPublishedSignature) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      // 両端末が近接publishしても同じrevisionを作らないよう、room正本からtransaction採番する。
      let committedRevision=0;
      await fb.runTransaction(fb.db,async transaction=>{
        const roomSnap=await transaction.get(roomRef);
        if(!roomSnap.exists())throw new Error("対戦ルームが見つかりません。");
        const remoteMatch=roomSnap.data()?.match;
        state.friendLastPublishRemoteMatch=remoteMatch?cloneJson(remoteMatch):null;
        if(getFriendMatchId(remoteMatch)!==expectedMatchId)return;
        if(clearInterruptId&&(remoteMatch?.interrupt?.id!==clearInterruptId||remoteMatch?.interrupt?.status!=="resolved"||remoteMatch?.interrupt?.requesterSide!==state.friendRole))return;
        if(applySerial){
          const remoteSerial=Number(remoteMatch?.turnSerial||0),remoteApplied=Number(remoteMatch?.turnStartAppliedSerial||0);
          const localSerial=Number(state.friendTurnSerial||0),localOwner=state.friendTurnOwner;
          const stableApply=localSerial===applySerial&&localOwner===state.friendRole&&state.friendTurnStarted===true;
          const appliedHandoff=localSerial===applySerial+1&&localOwner===otherFriendRole(state.friendRole)&&state.friendTurnStarted===false;
          if(remoteSerial!==applySerial||remoteMatch?.turnOwner!==state.friendRole||remoteMatch?.turnStarted!==true||remoteApplied>=applySerial||!applyToken||remoteMatch?.turnStartToken!==applyToken||(!stableApply&&!appliedHandoff))return;
        }
        const currentRevision=Number(remoteMatch?.stateRevision||0);
        committedRevision=Math.max(currentRevision,state.friendSyncRevision,state.friendLastAppliedRevision)+1;
        const update={
          "match.version":150,
          "match.stateRevision":committedRevision,
          "match.state":snapshot,
          "match.turnSide":state.friendTurnOwner||snapshot.turnSide,
          "match.turnSerial":Number(state.friendTurnSerial||snapshot.turnSerial||1),
          "match.turnOwner":state.friendTurnOwner||snapshot.turnOwner||snapshot.turnSide,
          "match.turnStarted":!!state.friendTurnStarted,
          "match.result":state.matchResult??null,
          updatedAt:fb.serverTimestamp()
        };
        update["match.turnStartAppliedSerial"]=applySerial||Number(state.friendTurnStartAppliedSerial||0);
        update["match.turnStartToken"]=state.friendTurnStartToken||null;
        if(!state.friendTurnStartToken)update["match.turnStartClaimedAt"]=null;
        if(clearInterruptId)update["match.interrupt"]=null;
        transaction.update(roomRef,update);
        if(clearInterruptId)transaction.delete(fb.doc(fb.db,"rooms",state.friendRoomId,"interactions",clearInterruptId));
      });
      if(!committedRevision||state.friendMatchId!==expectedMatchId)return;
      state.friendSyncRevision=Math.max(state.friendSyncRevision,committedRevision);
      state.friendLastPublishedSignature=signature;
      return true;
    }

    async function commitFriendTurnStartApplied(options={}){
      const serial=Number(options.friendTurnSerial||state.friendTurnSerial||0),token=options.friendTurnToken||state.friendTurnStartToken;
      if(state.battleMode!=="friend"||!serial||!token)return true;
      const previous=Number(state.friendTurnStartAppliedSerial||0);
      state.friendTurnStartAppliedSerial=serial;
      try{
        const committed=await publishFriendStateNow(state.friendMatchId,{applyTurnStartSerial:serial,turnStartToken:token});
        if(!committed)throw new Error("ターン開始の確定権が更新されました。");
        const context={matchId:state.friendMatchId,turnSerial:serial,turnOwner:state.friendRole,turnStartToken:token};
        const record=rememberCommittedFriendTurnContext(context);
        if(!record)throw new Error("ターン開始の確定結果を検証できませんでした。");
        return {ok:true,mode:record.mode};
      }catch(error){state.friendTurnStartAppliedSerial=previous;throw error;}
    }

    async function forcePublishFriendStateNow(reason = "state change") {
      if (state.battleMode !== "friend" || state.friendApplyingRemoteState) return;
      if(state.friendTurnStartAtomicActive){state.friendTurnStartDeferredPublish=true;return;}
      try {
        state.friendLastPublishedSignature = "";
        await publishFriendStateNow();
      } catch (error) {
        console.error(`PVP ${reason} sync failed`, error);
        setMessage(`オンライン同期エラー：${error.message || error}`);
      }
    }

    function canonicalFriendInterrupt() {
      const interrupt=state.friendRoomData?.match?.interrupt;
      if(!interrupt||!state.friendMatchId)return null;
      const interruptMatchId=interrupt.payload?.matchId||state.friendRoomData?.match?.matchId||state.friendRoomData?.match?.id;
      return interruptMatchId&&interruptMatchId!==state.friendMatchId?null:interrupt;
    }

    function isFriendInteractionBlocking() {
      if(state.battleMode!=="friend")return false;
      const interrupt=canonicalFriendInterrupt();
      return !!(state.friendCardResolving||state.friendInterruptWaiting||state.friendInterruptHandling||
        (interrupt&&["pending","resolved"].includes(interrupt.status)));
    }

    async function publishFriendInteractionFinalState(reason,actionId) {
      if(state.battleMode!=="friend")return true;
      state.friendLastPublishedSignature="";
      const committed=await publishFriendStateNow(state.friendMatchId,{clearInterruptId:actionId});
      if(committed!==true)throw new Error(`${reason}のcanonical同期が確定されませんでした。`);
      return true;
    }

    function canPublishFriendStateSafely() {
      if (state.battleMode !== "friend" || state.friendApplyingRemoteState || !state.friendMatchStarted) return false;
      // 通常の自動同期は、現在手番を持つ端末だけが書き込む。
      // ターンを相手へ渡す瞬間は endTurn() から明示的に publishFriendStateNow() を呼ぶ。
      if (state.turn !== "human") return false;
      if (state.animating || isFriendInteractionBlocking()) return false;
      if (!["attack", "setupTrap"].includes(state.mode)) return false;
      if (state.pendingRepairDiscard || state.pendingEqualTradeSelf || state.pendingRapidFireDiscard || state.pendingSwapFirst) return false;
      if (state.pendingTrapTargetEffect || state.selectedTrapCardIndex !== null) return false;
      if (state.pendingTerminalEnd?.human || state.pendingTerminalEnd?.cpu) return false;
      return true;
    }

    function scheduleFriendStatePublish() {
      if(state.friendTurnStartAtomicActive){state.friendTurnStartDeferredPublish=true;return;}
      if (!canPublishFriendStateSafely()) return;
      if (state.friendPublishTimer) clearTimeout(state.friendPublishTimer);
      const scheduledMatchId=state.friendMatchId;
      state.friendPublishTimer = setTimeout(() => {
        state.friendPublishTimer = null;
        publishFriendStateNow(scheduledMatchId).catch(error => {
          console.error("PVP state publish failed", error);
          setMessage(`オンライン同期エラー：${error.message || error}`);
        });
      }, 120);
    }


    function friendSideForLocalPlayer(player) {
      if (!state.friendRole) return null;
      return player === "human" ? state.friendRole : otherFriendRole();
    }

    function localPlayerForFriendSide(side) {
      if (!state.friendRole || !side) return null;
      return side === state.friendRole ? "human" : "cpu";
    }

    async function emitFriendFx(type, payload = {}) {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || state.friendApplyingRemoteState) return;
      const fx = {
        id: `${state.friendRole}-fx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        sourceSide: state.friendRole,
        payload: cloneJson(payload),
        createdAtMs: Date.now()
      };
      if(state.friendTurnStartAtomicActive){state.friendTurnStartPendingFx.push(fx);return;}
      await writeFriendFxNow(fx,{matchId:state.friendMatchId});
    }

    async function writeFriendFxNow(fx,guard={}) {
      const fb = firebaseApi();
      if (!fb) return false;
      const flushId=guard.turnSerial&&fx?.id?`fx:${friendTurnStartContextKey(guard)}:${fx.id}`:"";
      if(flushId&&state.friendTurnStartFlushedSideEffectIds.has(flushId))return false;
      const matchId=guard.matchId||state.friendMatchId;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      let committed=false;
      await fb.runTransaction(fb.db,async transaction=>{
        const roomSnap=await transaction.get(roomRef);
        const match=roomSnap.exists()?roomSnap.data()?.match:null;
        if(!canFlushCommittedTurnStartSideEffect(match,{...guard,matchId}))return;
        transaction.update(roomRef,{"match.version":51,"match.fx":fx,updatedAt:fb.serverTimestamp()});
        committed=true;
      });
      if(committed&&flushId){state.friendTurnStartFlushedSideEffectIds.add(flushId);if(state.friendTurnStartFlushedSideEffectIds.size>160)state.friendTurnStartFlushedSideEffectIds.delete(state.friendTurnStartFlushedSideEffectIds.values().next().value);}
      return committed;
    }

    async function playIncomingFriendFx(fx) {
      if (!fx?.id || !fx.type || fx.sourceSide === state.friendRole) return;
      const payload = fx.payload || {};
      if (fx.type === "card") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const card = CARD_LIBRARY[payload.cardId];
        if (player && card) await showCardPopup(player, card, false, 760);
        return;
      }
      if (fx.type === "advanceNoticeReveal") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const card = CARD_LIBRARY[payload.cardId];
        if (player && card) await showAdvanceNoticeRevealPopup(player, card, 1100);
        return;
      }
      if (fx.type === "chargeRecoil") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showChargeRecoilPopup(player, payload.source || "充電効果", 1250);
        return;
      }
      if (fx.type === "turnRestriction") {
        const player = localPlayerForFriendSide(payload.targetSide);
        if (player) await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: payload.restrictionType, broadcast: false });
        return;
      }
      if (fx.type === "magicalChant") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const stage = Math.max(1, Math.min(3, Number(payload.stage) || 1));
        if (player) {
          await showMagicalChantStage(player, stage);
          if (payload.completed) await showMagicalChantComplete(player);
        }
        return;
      }
      if(fx.type==="harpoonRecover"){
        const player=localPlayerForFriendSide(payload.targetSide);
        if(player&&["L","R"].includes(payload.hand)) await showHarpoonRecoveryFx(player,payload.hand,payload.vibration);
        return;
      }
      if(fx.type==="deusVult"){
        const targets=(payload.targets||[]).map(t=>({player:localPlayerForFriendSide(t.playerSide),hand:t.hand})).filter(t=>t.player&&["L","R"].includes(t.hand));
        await showDeusVultFx(targets);return;
      }
      if (fx.type === "attack") {
        const attacker = localPlayerForFriendSide(payload.attackerSide);
        const defender = localPlayerForFriendSide(payload.defenderSide);
        if (attacker && defender && payload.attackHand && payload.targetHand) {
          await animateAttackIntent(attacker, payload.attackHand, defender, payload.targetHand);
          clearHighlights();
          render();
        }
        return;
      }
      if (fx.type === "attackResult") {
        const defender = localPlayerForFriendSide(payload.defenderSide);
        if (defender && payload.targetHand) {
          const total = Number(payload.total);
          const finalValue = Number(payload.finalValue);
          if (Number.isFinite(total) && Number.isFinite(finalValue)) {
            await animateCalculation(defender, payload.targetHand, total, finalValue);
            state[defender][payload.targetHand] = finalValue;
            clearBrokenTraps(defender);
            render();
          }
        }
        return;
      }
      if (fx.type === "split") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showPopup(player, "分ける", "左右の本数を分け直しました。", "action", 650);
        return;
      }
      if (fx.type === "trapReveal") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const card = CARD_LIBRARY[payload.cardId];
        if (player && card) await showCardPopup(player, card, true, 760);
        return;
      }
      if (fx.type === "discardEffect") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const card = CARD_LIBRARY[payload.cardId];
        if (player && card) await showDiscardEffectPopup(player, payload.cardId, 900);
        return;
      }
      if (fx.type === "bulletproofBlocked") {
        const defender = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (defender) await showBulletproofBlockedPopup(defender, payload.sourceName || "遠距離攻撃", 900);
        return;
      }
      if (fx.type === "directiveClear") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showDirectiveClearFx(Number(payload.count) || 1, player);
        return;
      }
      if (fx.type === "willTorrent") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showWillTorrentFx(player, Number(payload.count) || 0);
        return;
      }
      if (fx.type === "finale") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showFinaleFx(player, Number(payload.power || 0));
        return;
      }
      if (fx.type === "logicAtelier") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const defender = localPlayerForFriendSide(payload.defenderSide);
        if (player && defender && payload.targetHand) {
          await showLogicAtelierFx(player, defender, payload.targetHand);
        }
        return;
      }
      if (fx.type === "arcanaSlave") {
        const caster = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        const targetPlayer = localPlayerForFriendSide(payload.targetSide);
        if (caster && targetPlayer && payload.targetHand) {
          await showArcanaSlaveCinematic(caster);
          await showArcanaTargetCircle(targetPlayer, payload.targetHand);
        }
        return;
      }
      if (fx.type === "judgmentCinematic") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player && payload.verdict) await showJudgmentCinematic(player, payload.verdict);
        return;
      }
      if (fx.type === "executionCinematic") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showExecutionCinematic(player);
        return;
      }
      if (fx.type === "executionStrike") {
        const targetPlayer = localPlayerForFriendSide(payload.targetSide);
        if (targetPlayer && payload.targetHand) {
          await showExecutionTargetSeal(targetPlayer, payload.targetHand);
        }
        return;
      }
      if (fx.type === "tiltedScales") {
        const leftPlayer = localPlayerForFriendSide(payload.leftSide);
        const rightPlayer = localPlayerForFriendSide(payload.rightSide);
        if (leftPlayer && rightPlayer) {
          await showTiltedScalesCinematic(leftPlayer, Number(payload.leftCount) || 0, rightPlayer, Number(payload.rightCount) || 0);
        }
        return;
      }
      if (fx.type === "randomDice") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player && payload.hand) {
          await showRoulettePopup(player, payload.hand, Number(payload.result) || 0);
        }
        return;
      }
      if (fx.type === "fatigue") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) {
          const text = payload.kind === "discard"
            ? `<div class="fatigue-popup-main">山札切れ</div><div>手札から「${escapeHtml(payload.cardName || "カード")}」をランダムに捨てました。</div>`
            : `<div class="fatigue-popup-main">山札切れ</div><div>${handNames[payload.hand] || "手"}が ${Number(payload.before) || 0} → ${Number(payload.after) || 0}</div>`;
          await showPopup(player, "疲労", text, "fatigue", 720, true);
        }
        return;
      }
      if (fx.type === "lightSpeedCircuit") {
        const player = localPlayerForFriendSide(payload.playerSide || fx.sourceSide);
        if (player) await showLightSpeedCircuitFx(player);
        return;
      }
    }

    function handleIncomingFriendFx(fx) {
      if (!fx?.id || fx.sourceSide === state.friendRole || state.friendHandledFxIds.has(fx.id)) return;
      state.friendHandledFxIds.add(fx.id);
      if (state.friendHandledFxIds.size > 120) {
        const first = state.friendHandledFxIds.values().next().value;
        state.friendHandledFxIds.delete(first);
      }
      state.friendFxQueue = state.friendFxQueue
        .catch(() => {})
        .then(() => playIncomingFriendFx(fx))
        .catch(error => {
          console.error("PVP fx receive failed", error);
        });
    }

    function makeFriendInterruptId() {
      return `${state.friendRole || "side"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function friendInteractionPrivateRef(actionId){
      const fb=firebaseApi();if(!fb||!state.friendRoomId||!fb.uid)return null;
      return fb.doc(fb.db,"rooms",state.friendRoomId,"interactionPrivate",`${fb.uid}_${actionId}`);
    }
    function secureFriendInteractionRef(actionId){const fb=firebaseApi();return fb&&state.friendRoomId?fb.doc(fb.db,"rooms",state.friendRoomId,"interactions",actionId):null;}
    function friendUidForRole(role){return role==="host"?state.friendRoomData?.hostUid:state.friendRoomData?.guestUid;}
    async function createSecureFriendInteraction({actionId,type,sourceCommit=null}){
      const fb=firebaseApi(),ref=secureFriendInteractionRef(actionId),targetRole=otherFriendRole();if(!fb||!ref||!fb.uid)throw new Error("オンライン選択を開始できません。");
      await fb.setDoc(ref,{actionId,matchId:state.friendMatchId,type,sourceRole:state.friendRole,targetRole,sourceUid:fb.uid,targetUid:friendUidForRole(targetRole),status:"pending",sourceCommit,createdAt:fb.serverTimestamp()});
    }
    async function respondSecureFriendInteraction(actionId,response){const fb=firebaseApi(),ref=secureFriendInteractionRef(actionId);if(!fb||!ref)throw new Error("オンライン選択へ応答できません。");await fb.updateDoc(ref,{status:"responded",targetInstanceId:response.instanceId,targetCommit:response.commit??null,targetNonce:response.nonce??null,respondedAt:fb.serverTimestamp()});}
    async function readSecureFriendInteraction(actionId){const fb=firebaseApi(),ref=secureFriendInteractionRef(actionId);if(!fb||!ref)return null;const snap=await fb.getDoc(ref);return snap.exists()?snap.data():null;}
    async function deleteSecureFriendInteraction(actionId){const fb=firebaseApi(),ref=secureFriendInteractionRef(actionId);if(fb&&ref)await fb.deleteDoc(ref).catch(()=>{});}
    function randomInteractionNonce(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");}
    async function sha256Hex(value){const bytes=new TextEncoder().encode(String(value)),digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(item=>item.toString(16).padStart(2,"0")).join("");}
    function tradeCommitText({matchId,actionId,role,instanceId,nonce}){return ["waribashi-trade-v1",matchId,actionId,role,instanceId,nonce].join("|");}
    async function makeTradeCommit(payload){return sha256Hex(tradeCommitText(payload));}
    async function savePrivateTradeChoice({actionId,instanceId,nonce,commit}){
      const fb=firebaseApi(),ref=friendInteractionPrivateRef(actionId);if(!fb||!ref)throw new Error("秘密選択を保存できません。");
      await fb.setDoc(ref,{uid:fb.uid,roomId:state.friendRoomId,matchId:state.friendMatchId,actionId,role:state.friendRole,type:"trade",instanceId,nonce,commit,updatedAt:fb.serverTimestamp()});
    }
    async function loadPrivateTradeChoice(actionId){const fb=firebaseApi(),ref=friendInteractionPrivateRef(actionId);if(!fb||!ref)return null;const snap=await fb.getDoc(ref);return snap.exists()?snap.data():null;}
    async function deletePrivateTradeChoice(actionId){const fb=firebaseApi(),ref=friendInteractionPrivateRef(actionId);if(fb&&ref)await fb.deleteDoc(ref).catch(()=>{});}

    async function writeFriendInterrupt(interrupt) {
      if(state.friendTurnStartAtomicActive){state.friendTurnStartPendingInterruptWrites.push(cloneJson(interrupt));return true;}
      return writeFriendInterruptNow(interrupt,{matchId:state.friendMatchId});
    }

    async function writeFriendInterruptNow(interrupt,guard={}) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId) throw new Error("Firebaseに接続されていません。");
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      const matchId=guard.matchId||state.friendMatchId;
      const flushId=guard.turnSerial&&interrupt?.id?`interrupt:${friendTurnStartContextKey(guard)}:${interrupt.id}:${interrupt.status||"pending"}`:"";
      if(flushId&&state.friendTurnStartFlushedSideEffectIds.has(flushId))return false;
      let committed=false;
      // 割り込みだけを書き換え、盤面 state / revision を古い値で巻き戻さない。
      await fb.runTransaction(fb.db,async transaction=>{
        const roomSnap=await transaction.get(roomRef);
        const match=roomSnap.exists()?roomSnap.data()?.match:null;
        if(!canFlushCommittedTurnStartSideEffect(match,{...guard,matchId}))return;
        transaction.update(roomRef,{"match.version":51,"match.interrupt":interrupt,updatedAt:fb.serverTimestamp()});
        committed=true;
      });
      if(committed&&flushId)state.friendTurnStartFlushedSideEffectIds.add(flushId);
      return committed;
    }

    async function requestRemoteFriendDecision(type, payload = {}, options = {}) {
      if (state.battleMode !== "friend" || !state.friendRole) return null;
      if(state.friendTurnStartAtomicActive)throw new Error("ターン開始stateの確定前にはオンライン判断を要求できません。");
      if (state.friendInterruptWaiting) throw new Error("別のオンライン割り込み処理を待っています。");
      const id = options.id || makeFriendInterruptId();
      const interrupt = {
        id,
        type,
        requesterSide: state.friendRole,
        targetSide: otherFriendRole(),
        status: "pending",
        payload: cloneJson(payload),
        createdAtMs: Date.now()
      };
      const resultPromise = new Promise((resolve, reject) => {
        state.friendInterruptWaiting = { id, resolve, reject, type };
      });
      await writeFriendInterrupt(interrupt);
      setMessage("相手の判断を待っています…");
      render();
      return await resultPromise;
    }

    async function respondFriendInterrupt(interrupt, response) {
      if (!interrupt?.id) return;
      await writeFriendInterrupt({
        ...interrupt,
        status: "resolved",
        response: cloneJson(response),
        resolvedBy: state.friendRole,
        resolvedAtMs: Date.now()
      });
    }

    async function clearResolvedFriendInterrupt(interruptId) {
      if (!interruptId || state.battleMode !== "friend" || !state.friendRoomId) return;
      if(state.friendTurnStartAtomicActive){state.friendTurnStartPendingInterruptWrites.push({__clearInterruptId:interruptId});return;}
      return clearResolvedFriendInterruptNow(interruptId,{matchId:state.friendMatchId});
    }

    async function clearResolvedFriendInterruptNow(interruptId,guard={}) {
      const fb = firebaseApi();
      if (!fb) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      const matchId=guard.matchId||state.friendMatchId;
      const flushId=guard.turnSerial?`interrupt-clear:${friendTurnStartContextKey(guard)}:${interruptId}`:"";
      if(flushId&&state.friendTurnStartFlushedSideEffectIds.has(flushId))return false;
      try {
        const current = state.friendRoomData?.match?.interrupt;
        if (current?.id && current.id !== interruptId) return;
        await fb.runTransaction(fb.db,async transaction=>{
          const roomSnap=await transaction.get(roomRef);
          const remoteMatch=roomSnap.exists()?roomSnap.data()?.match:null;
          if(remoteMatch?.interrupt?.id!==interruptId||!canFlushCommittedTurnStartSideEffect(remoteMatch,{...guard,matchId}))return;
          transaction.update(roomRef,{"match.interrupt":null,updatedAt:fb.serverTimestamp()});
          if(flushId)state.friendTurnStartFlushedSideEffectIds.add(flushId);
        });
      } catch (error) {
        console.warn("PVP interrupt cleanup failed", error);
      }
    }

    async function handleIncomingFriendInterrupt(interrupt) {
      if (!interrupt || interrupt.status !== "pending" || interrupt.targetSide !== state.friendRole) return;
      if (state.friendHandledInterruptIds.has(interrupt.id) || state.friendInterruptHandling) return;
      state.friendInterruptHandling = true;
      state.friendHandledInterruptIds.add(interrupt.id);
      try {
        let response = null;
        const payload = interrupt.payload || {};
        if (interrupt.type === "nekodamashi") {
          const use = await askHumanNekodamashi({ attacker: "cpu", targetHand: payload.targetHand || "L", isRapidFire: !!payload.isRapidFire });
          response = { use: !!use };
        } else if (interrupt.type === "manualTrap") {
          const localCandidates = (payload.candidates || []).map(item => ({
            placedHand: item.placedHand,
            index: Number(item.index),
            cardId: item.cardId,
            card: CARD_LIBRARY[item.cardId]
          })).filter(item => item.card);
          const chosen = await askHumanTrapChoice(localCandidates, {
            attacker: "cpu",
            attackHand: payload.attackHand || "L",
            targetHand: payload.targetHand || "L",
            isRapidFire: !!payload.isRapidFire
          });
          response = chosen
            ? { chosen: { placedHand: chosen.placedHand, index: chosen.index, cardId: chosen.cardId }, skipped: false }
            : { chosen: null, skipped: true };
        } else if (interrupt.type === "magicMirror") {
          const use = await askHumanMagicMirrorChoice("human", payload.hand || "L", payload.cardId);
          response = { use: !!use };
        } else if (interrupt.type === "terminalAppeal") {
          const terminalCard = CARD_LIBRARY[payload.cardId] || { name: payload.cardName || "終端カード" };
          const cardId = await askHumanTerminalAppeal("human", terminalCard);
          response = { cardId: cardId || null };
        } else if(interrupt.type==="forceCard"){
          if(payload.matchId!==state.friendMatchId)throw new Error("試合が更新されています。");
          const indexes=await beginHandCardSelection({min:1,max:1,filter:id=>isCountedHandCard(id),message:"「強制」：次の自分のターンに使用するカードを1枚選んでください。"});
          if(!indexes.length)throw new Error("選択できる通常手札がありません。");
          response={matchId:state.friendMatchId,actionId:interrupt.id,instanceId:handCardInstanceId("human",indexes[0])};
          await respondSecureFriendInteraction(interrupt.id,{instanceId:response.instanceId});
        } else if(interrupt.type==="trade"){
          if(payload.matchId!==state.friendMatchId||payload.actionId!==interrupt.id||!payload.sourceCommit)throw new Error("貿易情報が一致しません。");
          const indexes=await beginHandCardSelection({min:1,max:1,filter:(id,index)=>canDiscardHandCard("human",index,"trade"),message:"「貿易」：相手へ渡すカードを1枚選んでください。"});
          if(!indexes.length)throw new Error("貿易できるカードがありません。");
          const instanceId=handCardInstanceId("human",indexes[0]),nonce=randomInteractionNonce(),commit=await makeTradeCommit({matchId:state.friendMatchId,actionId:interrupt.id,role:state.friendRole,instanceId,nonce});
          response={matchId:state.friendMatchId,actionId:interrupt.id,targetCommit:commit,targetReveal:{instanceId,nonce}};
          await respondSecureFriendInteraction(interrupt.id,{instanceId,commit,nonce});
        }
        await respondFriendInterrupt(interrupt, response || {});
      } catch (error) {
        console.error("PVP interrupt handling failed", error);
        await respondFriendInterrupt(interrupt, { error: String(error?.message || error) });
      } finally {
        state.friendInterruptHandling = false;
      }
    }

    function consumeResolvedFriendInterrupt(interrupt) {
      const waiting = state.friendInterruptWaiting;
      if (!waiting || !interrupt || interrupt.id !== waiting.id || interrupt.status !== "resolved") return false;
      state.friendInterruptWaiting = null;
      if (interrupt.response?.error) waiting.reject(new Error(interrupt.response.error));
      else waiting.resolve(interrupt.response || {});
      render();
      return true;
    }

    async function resolveOnlineForceResponse(interrupt){
      const response=interrupt?.response,secure=await readSecureFriendInteraction(interrupt.id);if(response?.matchId!==state.friendMatchId||response?.actionId!==interrupt.id||secure?.status!=="responded"||secure?.targetInstanceId!==response.instanceId)return false;
      ensureHandCardInstances("cpu");const index=state.handCardInstances.cpu.indexOf(secure.targetInstanceId);if(index<0||!isCountedHandCard(state.hands.cpu[index]))return false;
      state.forcedCard.cpu={instanceId:secure.targetInstanceId,cardId:state.hands.cpu[index],pending:true,active:false};await publishFriendInteractionFinalState("強制の選択確定",interrupt.id);return true;
    }

    async function resolveOnlineTradeResponse(actionId,response){
      const ownPrivate=await loadPrivateTradeChoice(actionId),secure=await readSecureFriendInteraction(actionId);if(!ownPrivate||ownPrivate.matchId!==state.friendMatchId||secure?.status!=="responded"||secure?.sourceCommit!==ownPrivate.commit)throw new Error("貿易の秘密選択を復元できません。");
      const targetReveal={instanceId:secure.targetInstanceId,nonce:secure.targetNonce},targetCommit=secure.targetCommit;if(response?.matchId!==state.friendMatchId||response?.actionId!==actionId||response?.targetReveal?.instanceId!==targetReveal.instanceId||!targetReveal.instanceId||!targetCommit)throw new Error("相手の貿易選択が不完全です。");
      const verifiedTarget=await makeTradeCommit({matchId:state.friendMatchId,actionId,role:otherFriendRole(),instanceId:targetReveal.instanceId,nonce:targetReveal.nonce});if(verifiedTarget!==targetCommit)throw new Error("相手の貿易revealがcommitと一致しません。");
      const verifiedOwn=await makeTradeCommit({matchId:state.friendMatchId,actionId,role:state.friendRole,instanceId:ownPrivate.instanceId,nonce:ownPrivate.nonce});if(verifiedOwn!==ownPrivate.commit)throw new Error("自分の貿易revealがcommitと一致しません。");
      ensureHandCardInstances("human");ensureHandCardInstances("cpu");const ai=state.handCardInstances.human.indexOf(ownPrivate.instanceId),bi=state.handCardInstances.cpu.indexOf(targetReveal.instanceId);if(ai<0||bi<0||!canDiscardHandCard("human",ai,"trade")||!canDiscardHandCard("cpu",bi,"trade")){await deletePrivateTradeChoice(actionId);await clearResolvedFriendInterrupt(actionId);addLog("「貿易」は選択カードが移動したため不発。");return false;}
      const aid=state.hands.human[ai],bid=state.hands.cpu[bi],ainst=state.handCardInstances.human[ai],binst=state.handCardInstances.cpu[bi];state.hands.human[ai]=bid;state.hands.cpu[bi]=aid;state.handCardInstances.human[ai]=binst;state.handCardInstances.cpu[bi]=ainst;addLog("「貿易」で双方が秘密選択したカードを同時に交換した。");await publishFriendInteractionFinalState("貿易の同時交換",actionId);await deletePrivateTradeChoice(actionId);return true;
    }

    async function resumeOwnedFriendInteraction(interrupt){
      if(!interrupt||interrupt.requesterSide!==state.friendRole)return false;
      if(interrupt.status==="pending"){setMessage(interrupt.type==="trade"?"相手の貿易選択を待っています…":"相手がカードを選択しています…");render();return true;}
      if(interrupt.status!=="resolved"||state.friendInterruptWaiting)return false;
      const key=`resume:${interrupt.id}`;if(state.friendHandledInterruptIds.has(key))return true;state.friendHandledInterruptIds.add(key);
      try{if(interrupt.type==="forceCard")await resolveOnlineForceResponse(interrupt);else if(interrupt.type==="trade")await resolveOnlineTradeResponse(interrupt.id,interrupt.response||{});}catch(error){state.friendHandledInterruptIds.delete(key);setMessage(`オンライン選択の復元に失敗：${error.message||error}`);throw error;}return true;
    }

    function setFriendRoomUi(roomId, role = "host", shortCode = state.friendRoomShortCode) {
      const cleanId = extractRoomId(roomId) || makeRoomId();
      const roomChanged = state.friendRoomId !== cleanId || state.friendRole !== role;
      state.battleMode = "friend";
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      state.friendRoomId = cleanId;
      state.friendRoomShortCode = shortCode || state.friendRoomData?.shortCode || null;
      state.friendRole = role;
      if (roomChanged) resetFriendMatchEntryState();
      state.friendRoomUrl = buildRoomUrl(state.friendRoomShortCode||cleanId);
      if (elements.roomUrlText) elements.roomUrlText.textContent = state.friendRoomUrl;
      if (elements.battleRoomIdText) elements.battleRoomIdText.textContent = state.friendRoomShortCode||"------";
      if (elements.roomEntryControls) elements.roomEntryControls.hidden = true;
      if (elements.battleRoomLobby) elements.battleRoomLobby.hidden = false;
      elements.roomIdInput.value = state.friendRoomShortCode||"";
      elements.copyRoomUrlBtn.disabled = false;
      history.replaceState(null, "", state.friendRoomUrl);
    }

    function stableGuestLabel(uid = firebaseApi()?.uid || "guest") {
      const key = `waribashi_guest_label_${uid}`;
      try {
        const saved = localStorage.getItem(key);
        if (/^ゲスト#[0-9]{5}$/.test(saved || "")) return saved;
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        const label = `ゲスト#${String(bytes[0] % 100000).padStart(5, "0")}`;
        localStorage.setItem(key, label);
        return label;
      } catch (_) {
        return `ゲスト#${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
      }
    }

    function currentRoomMemberPresentation() {
      const fb = firebaseApi();
      const profile = state.socialProfile;
      const registered = !!profile && !window.WaribashiFirebase?.authUser?.isAnonymous;
      const displayName = registered ? String(profile.displayName || "プレイヤー") : stableGuestLabel(fb?.uid);
      return {
        uid: fb?.uid || "",
        role: "player",
        displayName,
        publicId: registered ? String(profile.publicId || "") : "",
        registered,
        guestLabel: registered ? "" : displayName,
        bannerId: registered ? String(profile.backgroundId || profile.bannerId || "default") : "default",
        backgroundId: registered ? String(profile.backgroundId || profile.bannerId || "default") : "default",
        titleId: registered ? String(profile.titleId || "rookie") : "rookie"
      };
    }

    function roomMember(data, role) {
      const slot = role === "host" ? "slot0" : "slot1";
      const member = data?.members?.[slot];
      if (member?.uid) return member;
      const uid = data?.[`${role}Uid`];
      if (!uid) return null;
      return { uid, displayName: "プレイヤー", publicId: "", registered: false, ready: !!data?.[`${role}Ready`] };
    }

    function localDeckDisplayName() {
      const slots = readDeckSlots()?.human || {};
      const current = cloneValidDeckCounts(state.deckCounts.human);
      const same = Object.values(slots).find(slot => JSON.stringify(cloneValidDeckCounts(slot.counts)) === JSON.stringify(current));
      return same?.name || "現在のデッキ";
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
        return;
      }

      if (data?.status === "closed") {
        elements.friendLobbyMessage.textContent = "この対戦ルームはホストによって閉じられました。";
      }

      const hostJoined = !!data?.hostJoined;
      const guestJoined = !!data?.guestJoined;
      const hostReady = !!data?.hostReady;
      const guestReady = !!data?.guestReady;
      const bothJoined = hostJoined && guestJoined;
      const bothReady = bothJoined && hostReady && guestReady;
      const isLobby = data?.status === "lobby";
      const regulation=regulationDefinition(data?.regulation?.modeId,data?.regulation?.modeVersion);
      if(elements.battleRoomName)elements.battleRoomName.textContent=data?.roomName||"対戦ルーム";
      if(elements.battleRoomVisibilityBadge)elements.battleRoomVisibilityBadge.textContent=data?.visibility==="public"?"公開":"非公開";
      if(elements.battleRoomRegulation)elements.battleRoomRegulation.textContent=regulation?.name||"未対応ルール";
      if(elements.battleRoomTags)elements.battleRoomTags.textContent=roomTagLabels(data?.tags).join(" / ");
      if(data?.shortCode){state.friendRoomShortCode=data.shortCode;if(elements.battleRoomIdText)elements.battleRoomIdText.textContent=data.shortCode;}
      const selfMember = roomMember(data, role);
      const opponentMember = roomMember(data, otherFriendRole(role));
      if (elements.battleRoomSelfName) elements.battleRoomSelfName.textContent = selfMember?.displayName || "あなた";
      if (elements.battleRoomOpponentName) elements.battleRoomOpponentName.textContent = opponentMember?.displayName || "参加者を待っています…";
      applyPlayerCardElement(elements.battleRoomSelfCard,playerCardPresentation(selfMember,"あなた"),{nameElement:elements.battleRoomSelfName});
      applyPlayerCardElement(elements.battleRoomOpponentCard,playerCardPresentation(opponentMember||{},"参加者を待っています…"),{nameElement:elements.battleRoomOpponentName});
      if (elements.battleRoomSelfStatus) elements.battleRoomSelfStatus.textContent = (role === "host" ? hostReady : guestReady) ? "準備完了" : "準備中";
      if (elements.battleRoomOpponentStatus) elements.battleRoomOpponentStatus.textContent = opponentMember ? ((role === "host" ? guestReady : hostReady) ? "準備完了" : "準備中") : "参加者待ち";
      if (elements.battleRoomDeckName) elements.battleRoomDeckName.textContent = localDeckDisplayName();
      if (elements.battleRoomLeaveBtn) elements.battleRoomLeaveBtn.textContent = role === "host" ? "ルームを閉じる" : "ルームを抜ける";

      elements.roomStatusText.textContent = `部屋ID：${state.friendRoomShortCode||"------"} / 状態：${data?.status || "接続中"}`;
      elements.roomPlayersText.textContent =
        `ホスト：${hostJoined ? "入室済み" : "待機中"}${hostReady ? "・準備完了" : ""} / ` +
        `ゲスト：${guestJoined ? "入室済み" : "待機中"}${guestReady ? "・準備完了" : ""} / ${roleLabel}`;

      elements.friendReadyBtn.disabled = !isLobby || !bothJoined || (role === "host" ? hostReady : guestReady);
      elements.friendUnreadyBtn.disabled = !isLobby || !(role === "host" ? hostReady : guestReady);
      const hostDeckOk = !!data?.hostDeckCounts;
      const guestDeckOk = !!data?.guestDeckCounts;
      if (elements.friendStartBattleBtn) {
        elements.friendStartBattleBtn.disabled = !(isLobby && role === "host" && bothReady && hostDeckOk && guestDeckOk);
        elements.friendStartBattleBtn.textContent = role === "host" ? "試合開始" : "ホストの試合開始を待っています";
      }

      if (!bothJoined) {
        elements.friendReadyText.textContent = role === "host"
          ? "相手の入室を待っています。部屋URLを友達に送ってください。"
          : "ホスト側の入室情報を確認中です。";
      } else if (bothReady) {
        elements.friendReadyText.textContent = role === "host" ? "2人とも準備完了です。共通戦闘画面で試合を開始できます。" : "2人とも準備完了です。ホストの試合開始を待っています。";
      } else {
        elements.friendReadyText.textContent = "2人そろいました。準備完了を押してください。";
      }
      if(!state.firebaseAuthReady)updateFriendAuthUi();
    }

    function clearFriendRoomConnectTimer(){
      if(state.friendRoomConnectTimer)clearTimeout(state.friendRoomConnectTimer);
      state.friendRoomConnectTimer=null;
    }
    function clearFriendRoomHeartbeat(){if(state.friendRoomHeartbeatTimer)clearInterval(state.friendRoomHeartbeatTimer);state.friendRoomHeartbeatTimer=null;}
    function startFriendRoomHeartbeat(roomId){
      const fb=firebaseApi();clearFriendRoomHeartbeat();if(!fb||!roomId||!state.friendRole)return;const publish=()=>{if(state.friendRoomId!==roomId||!state.friendRole)return;const field=state.friendRole==="host"?"hostLastSeen":"guestLastSeen";fb.updateDoc(fb.doc(fb.db,"rooms",roomId),{[field]:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()}).catch(error=>console.warn("[FriendRoom] heartbeat failed",error?.code,error?.message));};publish();state.friendRoomHeartbeatTimer=setInterval(publish,60000);
    }

    function clearFriendRoomLocalState({clearUrl=true}={}){
      clearFriendRoomConnectTimer();
      clearFriendRoomHeartbeat();
      state.friendUnsubscribe?.();state.friendUnsubscribe=null;
      state.friendRoomId=null;state.friendRoomShortCode=null;state.friendRoomData=null;state.friendRole=null;resetFriendMatchEntryState();
      if(elements.roomEntryControls)elements.roomEntryControls.hidden=false;
      if(elements.battleRoomLobby)elements.battleRoomLobby.hidden=true;
      if(elements.roomStatusText)elements.roomStatusText.textContent="未接続";
      if(clearUrl)history.replaceState(null,"",location.pathname);
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
      clearFriendRoomConnectTimer();
      elements.friendLobbyMessage.textContent="部屋情報を取得中…";
      if(elements.roomStatusText)elements.roomStatusText.textContent=`部屋ID：${state.friendRoomShortCode||"------"} / 状態：接続中`;
      state.friendRoomConnectTimer=setTimeout(()=>{
        state.friendRoomConnectTimer=null;
        elements.friendLobbyMessage.textContent="部屋情報を取得できませんでした。通信を確認して、もう一度入り直してください。";
        if(elements.roomStatusText)elements.roomStatusText.textContent=`部屋ID：${state.friendRoomShortCode||"------"} / 状態：接続エラー`;
      },8000);
      const roomRef = fb.doc(fb.db, "rooms", roomId);
      startFriendRoomHeartbeat(roomId);
      state.friendUnsubscribe = fb.onSnapshot(roomRef, (snapshot) => {
        clearFriendRoomConnectTimer();
        if (!snapshot.exists()) {
          clearFriendRoomLocalState();
          elements.friendLobbyMessage.textContent = "この部屋は存在しません。Room IDを確認してください。";
          return;
        }
        const data = snapshot.data();
        if(data?.status==="closed"&&state.friendRole==="guest"){
          clearFriendRoomLocalState();
          showScreen("friendLobby");
          elements.friendLobbyMessage.textContent="ホストが部屋を解散しました。";
          return;
        }
        state.friendRoomData = data;
        elements.friendLobbyMessage.textContent = "Firebaseと同期中です。別タブや友達の端末で入室すると、この表示が更新されます。";
        updateFriendLobbyView(data);
        updateBattleResultPostMatchView(data?.postMatch);
        if (data?.postMatch) {
          resolveFriendPostMatchAsHost(data).catch(error => {
            console.error("PVP post-match resolve failed", error);
            setMessage(`試合後同期エラー：${error.message || error}`);
          });
          applyResolvedFriendPostMatch(data);
        }
        const remoteResult = data?.match?.result ?? data?.match?.state?.result ?? null;
        const remoteResultReason = data?.match?.resultReason ?? data?.match?.state?.resultReason ?? null;
        const remoteSurrenderedBy = data?.match?.surrenderedBy ?? data?.match?.state?.surrenderedBy ?? null;
        const remoteSurrenderNoticeAcknowledged = data?.match?.surrenderNoticeAcknowledged ?? null;
        const remoteMatchId = data?.match ? getFriendMatchId(data.match) : null;
        const sameStartedMatch = state.friendMatchStarted && (!state.friendMatchId || state.friendMatchId === remoteMatchId);
        if ((data?.status === "playing" || data?.status === "lobby") && remoteResult && sameStartedMatch) {
          applySyncedBattleResult(remoteResult, remoteResultReason, remoteSurrenderedBy, remoteSurrenderNoticeAcknowledged, remoteMatchId);
          const surrenderGateOpen = remoteResultReason !== "surrender" || remoteSurrenderNoticeAcknowledged === true;
          if(state.friendRole==="host"&&data.status==="playing"&&!data.postMatch&&surrenderGateOpen){
            initializeFriendPostMatchAsHost(remoteResult).catch(error=>console.error("PVP post-match initialization failed",error));
          }
        }
        const fx = data?.match?.fx;
        if (fx) handleIncomingFriendFx(fx);
        const interrupt = data?.match?.interrupt;
        if (interrupt) {
          if (!consumeResolvedFriendInterrupt(interrupt)) {
            const interactionTask=interrupt.requesterSide===state.friendRole?resumeOwnedFriendInteraction(interrupt):handleIncomingFriendInterrupt(interrupt);
            interactionTask.catch(error => {
              console.error("PVP interrupt receive failed", error);
              setMessage(`オンライン割り込みエラー：${error.message || error}`);
            });
          }
        }
        const incomingMatchId = data?.match ? getFriendMatchId(data.match) : null;
        const shouldEnterPlayingMatch = (data?.status === "starting" || data?.status === "playing") && data?.match && (
          !state.friendMatchStarted ||
          state.friendMatchId !== incomingMatchId ||
          state.currentScreen !== "battle"
        );

        if (shouldEnterPlayingMatch) {
          try {
            enterFriendCommonBattle(data.match).catch(error=>console.error("PVP entry failed",error));
          } catch (error) {
            console.error("PVP battle entry failed", error);
            state.friendMatchStarted = false;
            state.friendMatchId = null;
            elements.friendLobbyMessage.textContent = `試合画面移行エラー：${error.message || error}`;
          }
        } else if (data?.status === "playing" && data?.match?.state && state.friendMatchStarted) {
          const revision = Number(data.match.stateRevision || 0);
          if (revision > state.friendLastAppliedRevision && revision > state.friendSyncRevision) {
            applyFriendCanonicalSnapshot(data.match.state, revision, data.match).catch(error => {
              console.error("PVP state apply failed", error);
              setMessage(`オンライン同期エラー：${error.message || error}`);
            });
          }
        }
      }, (error) => {
        clearFriendRoomConnectTimer();
        console.error("[FriendRoom] listener failed",{operation:"listen",roomId,role:state.friendRole,code:error?.code,message:error?.message});
        elements.friendLobbyMessage.textContent = "部屋情報を取得できませんでした。もう一度入り直してください。";
        if(elements.roomStatusText)elements.roomStatusText.textContent=`部屋ID：${state.friendRoomShortCode||"------"} / 状態：接続エラー`;
      });
    }

    async function createFriendRoomWithId(roomId,successMessage="Firebaseに部屋を作成しました。URLをコピーして友達に送ってください。",providedRoomRef=null,options={}) {
      const fb = firebaseApi();
      if (!fb) {
        elements.friendLobbyMessage.textContent = "Firebaseの読み込み中です。数秒待ってからもう一度押してください。";
        return;
      }
      const roomRef = providedRoomRef||fb.doc(fb.db, "rooms", roomId);
      const member = currentRoomMemberPresentation();
      const visibility=options.visibility==="public"?"public":"private",tags=normalizeRoomTags(options.tags||[]),regulation=regulationSnapshot(options.regulationId||"standard"),roomName=normalizeRoomName(options.roomName||"");
      let shortCode=options.shortCode||makeShortRoomCode(),createdRoom;
      try{
        for(let attempt=0;attempt<8;attempt+=1){
          shortCode=attempt?makeShortRoomCode():shortCode;
          const codeRef=fb.doc(fb.db,"roomCodes",shortCode),publicRef=fb.doc(fb.db,"publicRooms",roomId);
          try{await fb.runTransaction(fb.db,async transaction=>{
            const activeRef=fb.doc(fb.db,"activeRooms",fb.uid);const [codeSnap,activeSnap]=await Promise.all([transaction.get(codeRef),transaction.get(activeRef)]);if(codeSnap.exists())throw Object.assign(new Error("ROOM_CODE_COLLISION"),{code:"ROOM_CODE_COLLISION"});if(activeSnap.exists()&&activeSnap.data().roomId!==roomId)throw Object.assign(new Error("ACTIVE_ROOM_EXISTS"),{code:"ACTIVE_ROOM_EXISTS"});
            const stamp=fb.serverTimestamp();createdRoom={createdAt:stamp,updatedAt:stamp,status:"lobby",visibility,roomName,shortCode,tags,regulation,currentMatchId:null,matchSequence:0,members:{slot0:{...member,slot:0,ready:false,joinedAt:stamp},slot1:null},hostJoined:true,hostUid:fb.uid,guestUid:null,guestJoined:false,hostReady:false,guestReady:false,hostClientId:getFriendClientId(),hostLastSeen:stamp};
            transaction.set(roomRef,createdRoom);transaction.set(codeRef,{roomId,hostUid:fb.uid,createdAt:stamp});transaction.set(activeRef,{uid:fb.uid,roomId,role:"host",updatedAt:stamp});if(visibility==="public")transaction.set(publicRef,publicRoomMetadata(roomId,createdRoom,stamp));
          });break;}catch(error){if(error?.code==="ROOM_CODE_COLLISION"&&attempt<7)continue;throw error;}
        }
      }catch(error){
        console.error("[FriendRoom] create failed",{operation:"create",roomId,role:"host",code:error?.code,message:error?.message});
        clearFriendRoomLocalState();
        elements.friendLobbyMessage.textContent=roomCreateErrorMessage(error);
        throw error;
      }
      setFriendRoomUi(roomId, "host",shortCode);
      showScreen("friendLobby");
      state.friendRoomData=createdRoom;
      elements.friendLobbyMessage.textContent = successMessage;
      subscribeFriendRoom(roomId);
      updateFriendLobbyView(createdRoom);
    }

    async function createFriendRoom(options={}) {
      const fb=firebaseApi();if(!fb)return;
      if(state.roomCreateBusy)return;state.roomCreateBusy=true;
      try{
        if(await hasAnyActiveRoom()){const proceed=await confirmAndLeaveCurrentRoom("新しいルームを作成");if(!proceed)return false;}
        elements.friendLobbyMessage.textContent="部屋を作成中…";
        const roomRef=fb.doc(fb.collection(fb.db,"rooms"));
        const roomId=roomRef.id||String(roomRef).split("/").pop();
        return await createFriendRoomWithId(roomId,undefined,roomRef,options);
      }finally{state.roomCreateBusy=false;}
    }

    async function joinFriendRoom(roomIdRaw,{internalRoomId=false,publicOnly=false}={}) {
      const fb = firebaseApi();
      if (!fb) {
        elements.friendLobbyMessage.textContent = "Firebaseの読み込み中です。数秒待ってからもう一度押してください。";
        return;
      }
      let resolved;try{resolved=internalRoomId?{roomId:extractRoomId(roomIdRaw),shortCode:""}:await resolveRoomCode(roomIdRaw);}catch(error){resolved={roomId:"",shortCode:""};}
      const roomId = resolved.roomId;
      if (!roomId) {
        elements.friendLobbyMessage.textContent = "部屋IDかURLを入力してください。";
        return;
      }

      const roomRef = fb.doc(fb.db, "rooms", roomId);

      // If this account is already in another room, inspect the destination first
      // and then ask whether to leave/disband the current room. This keeps invalid
      // room IDs or already-full rooms from kicking the player out unnecessarily.
      const currentRoom=await ensureCurrentRoomLoaded();
      if(currentRoom&&currentRoom.roomId!==roomId){
        let preview;
        try{preview=await fb.getDoc(roomRef);}catch(error){throw error;}
        if(!preview.exists())throw Object.assign(new Error("ROOM_NOT_FOUND"),{code:"ROOM_NOT_FOUND"});
        const previewData=preview.data()||{};
        if(publicOnly&&previewData.visibility!=="public")throw Object.assign(new Error("ROOM_NOT_PUBLIC"),{code:"ROOM_NOT_PUBLIC"});
        if(!regulationDefinition(previewData.regulation?.modeId,previewData.regulation?.modeVersion))throw Object.assign(new Error("ROOM_RULE_UNSUPPORTED"),{code:"ROOM_RULE_UNSUPPORTED"});
        if(previewData.status==="closed")throw Object.assign(new Error("ROOM_CLOSED"),{code:"ROOM_CLOSED"});
        if(["starting","playing"].includes(previewData.status))throw Object.assign(new Error("ROOM_IN_MATCH"),{code:"ROOM_IN_MATCH"});
        if(previewData.guestJoined&&previewData.guestUid!==fb.uid)throw Object.assign(new Error("ROOM_FULL"),{code:"ROOM_FULL"});
        const proceed=await confirmAndLeaveCurrentRoom("別のルームに参加");
        if(!proceed){elements.friendLobbyMessage.textContent="現在のルームに残りました。";return false;}
      }

      const clientId = getFriendClientId();
      const joiningMember = currentRoomMemberPresentation();
      let resolvedRole = "guest";

      try {
        await fb.runTransaction(fb.db, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) {
            const error = new Error("ROOM_NOT_FOUND");
            error.code = "ROOM_NOT_FOUND";
            throw error;
          }

          const data = snapshot.data() || {};
          const activeRef=fb.doc(fb.db,"activeRooms",fb.uid),activeSnap=await transaction.get(activeRef);if(activeSnap.exists()&&activeSnap.data().roomId!==roomId)throw Object.assign(new Error("ACTIVE_ROOM_EXISTS"),{code:"ACTIVE_ROOM_EXISTS"});
          if(publicOnly&&data.visibility!=="public")throw Object.assign(new Error("ROOM_NOT_PUBLIC"),{code:"ROOM_NOT_PUBLIC"});
          if(!regulationDefinition(data.regulation?.modeId,data.regulation?.modeVersion))throw Object.assign(new Error("ROOM_RULE_UNSUPPORTED"),{code:"ROOM_RULE_UNSUPPORTED"});
          if(data.hostUid===fb.uid){
            resolvedRole="host";transaction.set(activeRef,{uid:fb.uid,roomId,role:"host",updatedAt:fb.serverTimestamp()});
            return;
          }
          const sameGuest = !!data.guestJoined && data.guestUid === fb.uid;
          if(data.status==="closed"){
            const error=new Error("ROOM_CLOSED");error.code="ROOM_CLOSED";throw error;
          }
          const roomUnavailable = ["starting", "playing"].includes(data.status);

          if (roomUnavailable && !sameGuest) {
            const error = new Error("ROOM_IN_MATCH");
            error.code = "ROOM_IN_MATCH";
            throw error;
          }

          if (data.guestJoined && !sameGuest) {
            const error = new Error("ROOM_FULL");
            error.code = "ROOM_FULL";
            throw error;
          }

          transaction.set(roomRef, {
            updatedAt: fb.serverTimestamp(),
            status: sameGuest ? data.status : "lobby",
            guestJoined: true,
            guestUid: fb.uid,
            guestClientId: clientId,
            guestReady: sameGuest ? !!data.guestReady : false,
            guestLastSeen: fb.serverTimestamp(),
            members: { ...(data.members || {slot0:null,slot1:null}), slot1: sameGuest && data.members?.slot1 ? data.members.slot1 : {...joiningMember,slot:1,ready:false,joinedAt:fb.serverTimestamp()} }
          }, { merge: true });
          transaction.set(activeRef,{uid:fb.uid,roomId,role:"guest",updatedAt:fb.serverTimestamp()});
          if(data.visibility==="public")transaction.delete(fb.doc(fb.db,"publicRooms",roomId));
        });
      } catch (error) {
        if (error?.code === "ROOM_NOT_FOUND" || error?.message === "ROOM_NOT_FOUND") {
          if(elements.roomEntryControls)elements.roomEntryControls.hidden=false;if(elements.battleRoomLobby)elements.battleRoomLobby.hidden=true;
          elements.friendLobbyMessage.textContent = "その部屋IDはまだ存在しません。ホストが部屋を作ってから入ってください。";
          return false;
        }
        if (error?.code === "ROOM_FULL" || error?.message === "ROOM_FULL") {
          if(elements.roomEntryControls)elements.roomEntryControls.hidden=false;if(elements.battleRoomLobby)elements.battleRoomLobby.hidden=true;
          elements.friendLobbyMessage.textContent = "この部屋には別のプレイヤーが先に参加しました。";
          return false;
        }
        if (error?.code === "ROOM_IN_MATCH" || error?.message === "ROOM_IN_MATCH") {
          if(elements.roomEntryControls)elements.roomEntryControls.hidden=false;if(elements.battleRoomLobby)elements.battleRoomLobby.hidden=true;
          elements.friendLobbyMessage.textContent = "このルームではすでに対戦が進行中です。新しく参加することはできません。";
          return false;
        }
        if (error?.code === "ROOM_CLOSED" || error?.message === "ROOM_CLOSED") {
          if(elements.roomEntryControls)elements.roomEntryControls.hidden=false;if(elements.battleRoomLobby)elements.battleRoomLobby.hidden=true;
          elements.friendLobbyMessage.textContent = "この部屋は解散されています。";
          return false;
        }
        if(error?.code==="ROOM_RULE_UNSUPPORTED"||error?.message==="ROOM_RULE_UNSUPPORTED"){elements.friendLobbyMessage.textContent="この対戦ルールには現在対応していません。";return false;}
        if(error?.code==="ROOM_NOT_PUBLIC"||error?.message==="ROOM_NOT_PUBLIC"){elements.friendLobbyMessage.textContent="この部屋は公開参加できません。";return false;}
        if(error?.code==="ACTIVE_ROOM_EXISTS"||error?.message==="ACTIVE_ROOM_EXISTS"){elements.friendLobbyMessage.textContent="現在のルームからの退出処理が完了していません。もう一度お試しください。";return false;}
        console.error("[FriendRoom] join failed",{operation:"join",roomId,role:"guest",code:error?.code,message:error?.message});
        throw error;
      }

      setFriendRoomUi(roomId, resolvedRole,resolved.shortCode);
      showScreen("friendLobby");
      elements.friendLobbyMessage.textContent = resolvedRole==="host" ? "ホストとして部屋へ再接続しました。" : "Firebase上の部屋に入室しました。";
      subscribeFriendRoom(roomId);
      return true;
    }

    async function setFriendReady(ready) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId || !state.friendRole) return;
      if(ready){const ruleId=state.friendRoomData?.regulation?.modeId||"standard",message=ruleDeckValidationMessage(ruleId,state.deckCounts.human);if(message){elements.friendLobbyMessage.textContent=message;return false;}}
      const key = state.friendRole === "host" ? "hostReady" : "guestReady";
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      const deckKey = state.friendRole === "host" ? "hostDeckCounts" : "guestDeckCounts";
      const slot = state.friendRole === "host" ? "slot0" : "slot1";
      const members = { ...(state.friendRoomData?.members || {}) };
      if (members[slot]) members[slot] = { ...members[slot], ready };
      await fb.setDoc(roomRef, {
        [key]: ready,
        [deckKey]: ready ? cloneValidDeckCounts(state.deckCounts.human) : null,
        members,
        updatedAt: fb.serverTimestamp(),
        ...(state.friendRole === "host" ? { status: "lobby" } : {})
      }, { merge: true });
    }

    async function leaveFriendRoom() {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId || !state.friendRole) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      if (state.friendRole === "host") {
        await fb.runTransaction(fb.db,async transaction=>{transaction.update(roomRef,{status:"closed",updatedAt:fb.serverTimestamp()});if(state.friendRoomData?.visibility==="public")transaction.delete(fb.doc(fb.db,"publicRooms",state.friendRoomId));if(state.friendRoomData?.shortCode)transaction.delete(fb.doc(fb.db,"roomCodes",state.friendRoomData.shortCode));transaction.delete(fb.doc(fb.db,"activeRooms",fb.uid));});
      } else {
        const data = state.friendRoomData || {};
        const patch={status:"lobby",guestUid:null,guestJoined:false,guestReady:false,guestDeckCounts:null,guestClientId:null,guestLastSeen:null,members:{...(data.members||{}),slot1:null},updatedAt:fb.serverTimestamp()};
        await fb.runTransaction(fb.db,async transaction=>{transaction.update(roomRef,patch);if(data.visibility==="public")transaction.set(fb.doc(fb.db,"publicRooms",state.friendRoomId),publicRoomMetadata(state.friendRoomId,{...data,...patch},fb.serverTimestamp()));transaction.delete(fb.doc(fb.db,"activeRooms",fb.uid));});
      }
      clearFriendRoomLocalState();
      showScreen("battleSelect");
    }

    function friendPostMatchChoiceKey(role = state.friendRole) {
      return role === "host" ? "hostChoice" : "guestChoice";
    }

    function friendPostMatchResolutionAction(hostChoice,guestChoice) {
      if(hostChoice==="lobby"||guestChoice==="lobby")return "lobby";
      if(hostChoice==="deck"||guestChoice==="deck")return "deck";
      if(hostChoice==="rematch"&&guestChoice==="rematch")return "lobby";
      return null;
    }

    function updateBattleResultPostMatchView(postMatch = state.friendRoomData?.postMatch) {
      if (!elements.battleResultPostActions) return;
      const isFriend = state.battleMode === "friend";
      elements.battleResultPostActions.classList.toggle("hidden", !isFriend);
      if (!isFriend) return;
      const myChoice = postMatch?.[friendPostMatchChoiceKey()] || state.friendPostMatchChoice || null;
      const otherChoice = postMatch?.[friendPostMatchChoiceKey(otherFriendRole())] || null;
      const labels = { rematch: "再戦", deck: "デッキを編集して再戦", lobby: "試合部屋へ戻る" };
      elements.battleResultRematchBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      elements.battleResultDeckBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      elements.battleResultLobbyBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      if (postMatch?.resolvedAction) {
        elements.battleResultWait.textContent = "試合後の移動を同期しています…";
      } else if (myChoice) {
        elements.battleResultWait.textContent = myChoice==="rematch"&&!otherChoice
          ? "相手の選択を待っています…"
          : `あなた：${labels[myChoice]} / 相手：${otherChoice ? labels[otherChoice] : "選択待ち"}`;
      } else {
        elements.battleResultWait.textContent = "次の行動を選んでください。";
      }
    }

    async function requestFriendPostMatchChoice(choice) {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || !state.gameOver) return;
      if (state.matchResultReason === "surrender" && state.friendSurrenderNoticeAcknowledged !== true) return;
      if (!["rematch", "deck", "lobby"].includes(choice)) return;
      const fb = firebaseApi();
      if (!fb) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      if(state.friendRole === "guest" && !state.friendRoomData?.postMatch){
        elements.battleResultWait.textContent="ホストが試合結果を同期しています…";
        return;
      }
      state.friendPostMatchResolving=true;
      let committedPost;
      try{
        committedPost=await fb.runTransaction(fb.db,async transaction=>{
          const snap=await transaction.get(roomRef);if(!snap.exists())throw new Error("試合部屋が見つかりません。");
          const room=snap.data()||{},matchId=getFriendMatchId(room.match),post=room.postMatch||{};
          if(String(matchId||"")!==String(state.friendMatchId||"")||String(post.matchId||"")!==String(state.friendMatchId||""))throw new Error("別の試合へ切り替わっています。");
          if(!room.match?.result&&!room.match?.state?.gameOver)throw new Error("試合結果がまだ確定していません。");
          if(post.resolvedAction)return post;
          const next={...post,[friendPostMatchChoiceKey()]:choice},action=friendPostMatchResolutionAction(next.hostChoice,next.guestChoice),patch={[`postMatch.${friendPostMatchChoiceKey()}`]:choice,updatedAt:fb.serverTimestamp()};
          if(action){patch["postMatch.resolvedAction"]=action;patch["postMatch.resolutionId"]=`${state.friendMatchId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;patch.status="lobby";patch.hostReady=false;patch.guestReady=false;patch["members.slot0.ready"]=false;patch["members.slot1.ready"]=false;next.resolvedAction=action;next.resolutionId=patch["postMatch.resolutionId"];}
          transaction.update(roomRef,patch);return next;
        });
        state.friendPostMatchChoice=choice;
      }finally{state.friendPostMatchResolving=false;}
      updateBattleResultPostMatchView({
        ...(committedPost||state.friendRoomData?.postMatch||{}),matchId:state.friendMatchId
      });
    }

    async function resolveFriendPostMatchAsHost(data) {
      if (state.friendRole !== "host" || state.friendPostMatchResolving) return;
      const post = data?.postMatch;
      if (!post || String(post.matchId || "") !== String(getFriendMatchId(data?.match) || "")) return;
      if (post.resolvedAction) return;
      const action=friendPostMatchResolutionAction(post.hostChoice||null,post.guestChoice||null);
      if (!action) return;

      state.friendPostMatchResolving = true;
      try {
        const fb = firebaseApi();
        if (!fb) return;
        const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
        await fb.runTransaction(fb.db,async transaction=>{const snap=await transaction.get(roomRef);if(!snap.exists())return;const room=snap.data()||{},current=room.postMatch||{};if(current.resolvedAction||String(current.matchId||"")!==String(state.friendMatchId||""))return;const expected=friendPostMatchResolutionAction(current.hostChoice,current.guestChoice);if(!expected)return;transaction.update(roomRef,{"postMatch.resolvedAction":expected,"postMatch.resolutionId":`${state.friendMatchId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,status:"lobby",hostReady:false,guestReady:false,"members.slot0.ready":false,"members.slot1.ready":false,updatedAt:fb.serverTimestamp()});});
      } finally {
        state.friendPostMatchResolving = false;
      }
    }

    function applyResolvedFriendPostMatch(data) {
      const post = data?.postMatch;
      if (!post?.resolvedAction || !post.resolutionId) return;
      if (state.friendPostMatchResolutionId === post.resolutionId) return;
      state.friendPostMatchResolutionId = post.resolutionId;
      const action = post.resolvedAction;
      const myChoice = post[friendPostMatchChoiceKey()] || state.friendPostMatchChoice;
      hideBattleResult();
      resetFriendMatchEntryState();
      state.friendPostMatchResolutionId = post.resolutionId;
      if (action === "deck") {
        if (myChoice === "deck") {
          state.friendDeckEditReturnToLobby = true;
          state.editingDeckOwner = "human";
          state.deckRuleContext={ruleId:data?.regulation?.modeId||"standard"};
          showScreen("friendLobby");updateFriendLobbyView(data);
          queueMicrotask(()=>{if(state.friendDeckEditReturnToLobby&&state.friendRoomId){showScreen("deck");setMessage("再戦用のあなたのデッキを編集してください。編集後は試合部屋へ戻り、準備完了を押してください。");}});
        } else {
          showScreen("friendLobby");
          elements.friendLobbyMessage.textContent = "相手がデッキを変更しています。変更後、2人とも準備完了してください。";
        }
      } else if (action === "lobby") {
        showScreen("friendLobby");
        elements.friendLobbyMessage.textContent = "同じ部屋のロビーへ戻りました。再戦する場合は準備完了を押してください。";
      }
      updateFriendLobbyView(data);
    }

    function getFriendMatchId(match) {
      if (!match) return null;
      const raw = match.matchId ?? match.createdAtMs ?? null;
      return raw == null ? null : String(raw);
    }

    function resetFriendMatchEntryState() {
      if(state.friendPublishTimer)clearTimeout(state.friendPublishTimer);
      state.friendPublishTimer=null;
      clearFriendTurnClaimRetry();
      clearFriendTurnStartAtomicState();
      state.friendTurnStartCommittedKeys.clear();
      state.friendTurnStartCommittedContexts.clear();
      state.friendTurnStartFlushedSideEffectIds.clear();
      state.friendTurnClaimInFlight=false;
      state.friendMatchStarted = false;
      state.friendMatchId = null;
      state.friendSyncRevision = 0;
      state.friendLastAppliedRevision = 0;
      state.friendLastPublishedSignature = "";
      state.friendSnapshotHydrated = false;
      state.friendStartingTurnKey = "";
      state.friendStartedTurnKey = "";
      state.friendTurnSerial = 0;
      state.friendTurnOwner = null;
      state.friendTurnStarted = false;
      state.friendTurnStartAppliedSerial = 0;
      state.friendTurnStartToken = null;
      state.friendTurnStartClaimedAtMs = 0;
      state.friendInterruptWaiting = null;
      state.friendInterruptHandling = false;
      state.friendHandledInterruptIds = new Set();
      state.matchResult = null;
      state.matchResultReason = null;
      state.surrenderedBy = null;
      state.lastShownResultKey = null;
      state.friendResultPublishing = false;
      state.friendPostMatchChoice = null;
      state.friendPostMatchResolutionId = null;
      state.friendPostMatchResolving = false;
      state.friendDeckEditReturnToLobby = false;
      state.friendSurrenderNoticeAcknowledged = null;
      state.friendSurrenderNoticeMatchId = null;
      state.friendSurrenderNoticeRunning = false;
      state.friendSurrenderAckWriting = false;
      elements.battleVsCutIn?.classList.remove("show");elements.battleVsCutIn?.setAttribute("aria-hidden","true");
      hideBattleResult();
      setSurrenderFlowOverlay(null);
    }

    function buildDeckFromSubmittedCounts(counts) {
      const deck = [];
      const fixed = cloneValidDeckCounts(counts || {});
      for (const [cardId, qty] of Object.entries(fixed)) {
        for (let i = 0; i < qty; i++) deck.push(cardId);
      }
      return deck;
    }

    async function startFriendCommonBattle(options = {}) {
      if (state.friendRole !== "host" || !state.friendRoomId) return;
      const data = state.friendRoomData;
      const ruleId=data?.regulation?.modeId||"standard";
      const hostRuleError=ruleDeckValidationMessage(ruleId,data?.hostDeckCounts||{}),guestRuleError=ruleDeckValidationMessage(ruleId,data?.guestDeckCounts||{});
      if(hostRuleError||guestRuleError){elements.friendLobbyMessage.textContent=hostRuleError||guestRuleError;return;}
      if (!data?.hostReady || !data?.guestReady || !data?.hostDeckCounts || !data?.guestDeckCounts || data?.status !== "lobby") {
        elements.friendLobbyMessage.textContent = "2人の準備完了とデッキ提出が必要です。";
        return;
      }
      const fb = firebaseApi();
      if (!fb) return;
      const hostDeck = shuffle(buildDeckFromSubmittedCounts(data.hostDeckCounts));
      const guestDeck = shuffle(buildDeckFromSubmittedCounts(data.guestDeckCounts));
      const initialHost = createOpeningSideFromShuffledDeck(hostDeck,data.hostDeckCounts);
      const initialGuest = createOpeningSideFromShuffledDeck(guestDeck,data.guestDeckCounts);
      const emptySideState = (side) => ({
        L: side.L, R: side.R, traps: { L: [], R: [] }, deck: side.deck, hand: side.hand, discard: side.discard,
        temp: { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, chargeCardsUsed: [] },
        noSplit: false, extraActions: 0, pendingAcceleration: 0, activeAcceleration: 0, pendingNoDraw: 0, activeNoDraw: 0, pendingTerminalEnd: false,
        pendingIntemperanceCardLock: false, activeIntemperanceCardLock: false, pendingCardUseLockSource: "", activeCardUseLockSource: "", pendingMagicalHeartDraw: 0,
        magicalChantProgress: 0, magicalChantCompleted: false,
        costLimitNextTurn: null, activeCostLimit: null, berserkerTurns: 0, firstTurnStarted: false,
        selectedTheme: null, performanceLevel: 0, resonanceTriggeredThisTurn: false,
        pendingPrestoAttack: false, sforzandoTurnBonus: 0,
        usedRondoFamilies: [], usedRondoCards: [], pendingDrawLock: false, activeDrawLock: false,
        quarterRestPending: false, quarterRestActive: false, wholeRestPending: false, wholeRestActive: false,
        pendingCanonHits: [], furiosoSkipPending: false, furiosoSkipActive: false, personalTurnCount: 0,
        directiveTotalClears:0,naturalFaithUses:0,divineProofUsed:false,pendingDeusVult:false,
        pendingDirectiveDraw:0,pendingDirectiveNoDraw:0,pendingDirectiveBonusDraw:0,lastDirectiveClearCount:0,activeDirectiveBlessing:0,
        pendingDirectiveHandAttackModifier:{L:0,R:0},pendingDirectiveNextAttackModifier:0,pendingDirectiveReformContinue:false,activeDirectiveReformContinue:false,pendingDirectiveNoSplit:false,pendingDirectiveAnnihilation:false,activeDirectiveAnnihilation:false,pendingDirectiveAttackLimitDelta:0
      });
      const createdAtMs = Date.now();
      const nextSequence = Number(data.matchSequence || 0) + 1;
      const match = {
        version: 153,
        regulation: cloneJson(data.regulation||DEFAULT_REGULATION),
        matchId: `${state.friendRoomId}-${nextSequence}-${createdAtMs}`,
        matchSequence: nextSequence,
        createdAtMs,
        startingPlayer: null,
        startingPlayerDecided: false,
        turnSide: null,
        turnNumber: 1,
        turnSerial: 1,
        turnOwner: null,
        turnStarted: false,
        turnStartAppliedSerial: 0,
        turnStartToken: null,
        turnStartClaimedAt: null,
        host: initialHost,
        guest: initialGuest,
        stateRevision: 1,
        state: {
          schemaVersion: 3,
          host: emptySideState(initialHost),
          guest: emptySideState(initialGuest),
          startingPlayer: null,
          startingPlayerDecided: false,
          turnSide: null,
          turnNumber: 1,
          turnSerial: 1,
          turnOwner: null,
          turnStarted: false,
          turnStartAppliedSerial: 0,
          gameOver: false,
          result: null,
          log: ["オンライン対戦を開始しました。"],
          lastAction: null
        },
        result: null
      };
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.runTransaction(fb.db, async transaction => {
        const snapshot = await transaction.get(roomRef);
        if (!snapshot.exists()) throw new Error("対戦ルームが見つかりません。");
        const latest = snapshot.data();
        if (latest.status !== "lobby" || !latest.hostReady || !latest.guestReady || Number(latest.matchSequence || 0) + 1 !== nextSequence) throw new Error("ロビーの状態が更新されました。もう一度お試しください。");
        transaction.update(roomRef,{status:"starting",currentMatchId:match.matchId,matchSequence:nextSequence,match,postMatch:null,updatedAt:fb.serverTimestamp()});
      });
      // ホストはonSnapshot待ちだけに依存せず、書き込み成功後に同じmatchへ確実に入る。
      const startedMatchId = getFriendMatchId(match);
      if (!state.friendMatchStarted || state.friendMatchId !== startedMatchId || state.currentScreen !== "battle") {
        enterFriendCommonBattle(match).catch(error=>console.error("PVP entry failed",error));
      }
    }

    function playerPresentation(member,fallback){return playerCardPresentation(member||{},fallback);}
    function vsCutInStorageKey(matchId){return `waribashi_vs_seen_${matchId}`;}
    function applyVsPlayerPresentation(kind,presentation){const card=elements.battleVsCutIn?.querySelector(`[data-player-card="${kind}"]`),name=kind==="self"?elements.battleVsSelfName:elements.battleVsOpponentName;applyPlayerCardElement(card,presentation,{nameElement:name});}
    async function showFriendVsCutIn(match) {
      const matchId=getFriendMatchId(match),alreadyPersisted=(()=>{try{return sessionStorage.getItem(vsCutInStorageKey(matchId))==="1";}catch(_){return false;}})();
      if(!elements.battleVsCutIn||!matchId||state.friendVsShownMatchIds.has(matchId)||alreadyPersisted||match.startingPlayerDecided)return;
      state.friendVsShownMatchIds.add(matchId);try{sessionStorage.setItem(vsCutInStorageKey(matchId),"1");}catch(_){}
      applyVsPlayerPresentation("self",playerPresentation(roomMember(state.friendRoomData,state.friendRole),"あなた"));applyVsPlayerPresentation("opponent",playerPresentation(roomMember(state.friendRoomData,otherFriendRole()),"相手"));
      elements.battleVsCutIn.classList.add("show");elements.battleVsCutIn.setAttribute("aria-hidden","false");
      try{await delay(1250);}finally{elements.battleVsCutIn.classList.remove("show");elements.battleVsCutIn.setAttribute("aria-hidden","true");}
    }

    async function waitForFriendStartingPlayer(matchId,timeoutMs=12000) {
      const deadline=Date.now()+timeoutMs;
      while(Date.now()<deadline){
        const room=state.friendRoomData;
        if(getFriendMatchId(room?.match)===matchId&&room.match.startingPlayerDecided&&["host","guest"].includes(room.match.startingPlayer))return room.match;
        await delay(80);
      }
      throw new Error("先攻決定の同期を待機できませんでした。");
    }

    async function ensureFriendStartingPlayerDecided(match) {
      const matchId=getFriendMatchId(match);
      if(match?.startingPlayerDecided&&["host","guest"].includes(match.startingPlayer))return match;
      if(state.friendRole!=="host")return waitForFriendStartingPlayer(matchId);
      // Randomness is generated once by the host, only after the VS stage completes.
      const candidate=chooseFriendStartingRole();
      const fb=firebaseApi(),roomRef=fb.doc(fb.db,"rooms",state.friendRoomId);
      const resolved=await fb.runTransaction(fb.db,async transaction=>{
        const snapshot=await transaction.get(roomRef);
        if(!snapshot.exists())throw new Error("対戦ルームが見つかりません。");
        const room=snapshot.data(),current=room.match;
        if(getFriendMatchId(current)!==matchId)throw new Error("別の試合が開始されています。");
        if(current.startingPlayerDecided)return current;
        if(room.status!=="starting"||!room.guestUid)throw new Error("試合開始を続行できません。");
        transaction.update(roomRef,{status:"playing","match.startingPlayer":candidate,"match.startingPlayerDecided":true,"match.turnSide":candidate,"match.turnOwner":candidate,"match.turnSerial":1,"match.turnStarted":false,"match.turnStartAppliedSerial":0,"match.turnStartToken":null,"match.turnStartClaimedAt":null,"match.state.startingPlayer":candidate,"match.state.startingPlayerDecided":true,"match.state.turnSide":candidate,"match.state.turnOwner":candidate,"match.state.turnSerial":1,"match.state.turnStarted":false,"match.state.turnStartAppliedSerial":0,updatedAt:fb.serverTimestamp()});
        return {...current,startingPlayer:candidate,startingPlayerDecided:true,turnSide:candidate,turnOwner:candidate,turnSerial:1,turnStarted:false,turnStartAppliedSerial:0,turnStartToken:null,turnStartClaimedAt:null,state:{...current.state,startingPlayer:candidate,startingPlayerDecided:true,turnSide:candidate,turnOwner:candidate,turnSerial:1,turnStarted:false,turnStartAppliedSerial:0}};
      });
      return resolved;
    }

    async function enterFriendCommonBattle(match) {
      if(state.friendPublishTimer)clearTimeout(state.friendPublishTimer);
      state.friendPublishTimer=null;
      clearFriendTurnClaimRetry();
      const mine = state.friendRole === "host" ? match.host : match.guest;
      const other = state.friendRole === "host" ? match.guest : match.host;
      state.battleMode = "friend";
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      refreshPlayerDisplayNames();
      state.friendMatchStarted = true;
      state.friendMatchId = getFriendMatchId(match) || String(Date.now());
      state.friendSyncRevision = Number(match.stateRevision || 0);
      state.friendLastAppliedRevision = Number(match.stateRevision || 0);
      state.friendLastPublishedSignature = match.state ? JSON.stringify(match.state) : "";
      state.friendSnapshotHydrated = false;
      state.friendStartingTurnKey = "";
      state.friendStartedTurnKey = "";
      state.friendTurnSerial=Number(match.turnSerial||match.state?.turnSerial||1);
      state.friendTurnOwner=match.turnOwner||match.state?.turnOwner||match.turnSide||null;
      state.friendTurnStarted=typeof match.turnStarted==="boolean"?match.turnStarted:match.state?.turnStarted===true;
      state.friendTurnStartAppliedSerial=Number(match.turnStartAppliedSerial??match.state?.turnStartAppliedSerial??(state.friendTurnStarted?state.friendTurnSerial:Math.max(0,state.friendTurnSerial-1)));
      state.friendTurnStartToken=match.turnStartToken||null;
      state.friendTurnStartClaimedAtMs=friendTimestampMillis(match.turnStartClaimedAt);
      clearFriendTurnClaimRetry();
      state.friendTurnClaimInFlight=false;
      state.friendInterruptWaiting = null;
      state.friendInterruptHandling = false;
      state.friendHandledInterruptIds = new Set();
      state.deckCounts.human = { ...DEFAULT_DECK_COUNTS, ...(mine.deckCounts || {}) };
      state.deckCounts.cpu = { ...DEFAULT_DECK_COUNTS, ...(other.deckCounts || {}) };
      state.human = { L: mine.L ?? 1, R: mine.R ?? 1 };
      state.cpu = { L: other.L ?? 1, R: other.R ?? 1 };
      state.decks.human = [...(mine.deck || [])];
      state.decks.cpu = [...(other.deck || [])];
      state.hands.human = [...(mine.hand || [])];
      state.hands.cpu = [...(other.hand || [])];
      state.discard.human = [...(mine.discard || [])];
      state.discard.cpu = [...(other.discard || [])];
      state.traps.human = { L: [], R: [] };
      state.traps.cpu = { L: [], R: [] };
      state.pendingChargeStun = { human: false, cpu: false };
      state.pendingChargeStunSource = { human: "", cpu: "" };
      state.lightSpeedCircuitUsed = { human: false, cpu: false };
      // 新しいオンライン試合では、前試合の魔法少女系・ターン予約状態を必ず破棄する。
      state.pendingIntemperanceCardLock = { human: false, cpu: false };
      state.activeIntemperanceCardLock = { human: false, cpu: false };
      state.pendingCardUseLockSource = { human: "", cpu: "" };
      state.activeCardUseLockSource = { human: "", cpu: "" };
      state.judgmentPrisonTurns = { human: 0, cpu: 0 };
      state.pendingAppealExecution = { human: 0, cpu: 0 };
      state.personalTurnCount = { human: 0, cpu: 0 };
      state.pendingMagicalHeartDraw = { human: 0, cpu: 0 };
      state.magicalChantProgress = { human: 0, cpu: 0 };
      state.magicalChantCompleted = { human: false, cpu: false };
      resetDirectiveMatchState();
      state.temp.human = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0,naturalFaithActive:false,opponentZeroedThisTurn:false,chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.temp.cpu = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0,naturalFaithActive:false,opponentZeroedThisTurn:false,chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.noSplit = state.noSplit || { human: false, cpu: false };
      state.extraActions = state.extraActions || { human: 0, cpu: 0 };
      state.pendingAcceleration = state.pendingAcceleration || { human: 0, cpu: 0 };
      state.activeAcceleration = state.activeAcceleration || { human: 0, cpu: 0 };
      state.pendingNoDraw = { human: 0, cpu: 0 };
      state.activeNoDraw = { human: 0, cpu: 0 };
      state.pendingTerminalEnd = state.pendingTerminalEnd || { human: false, cpu: false };
      state.costLimitNextTurn = state.costLimitNextTurn || { human: null, cpu: null };
      state.activeCostLimit = state.activeCostLimit || { human: null, cpu: null };
      state.berserkerTurns = state.berserkerTurns || { human: 0, cpu: 0 };
      state.firstTurnStarted = state.firstTurnStarted || { human: false, cpu: false };
      state.startingPlayer = match.startingPlayer || match.state?.startingPlayer || match.turnSide || null;
      state.startingPlayerDecided = state.startingPlayer === "host" || state.startingPlayer === "guest";
      state.turn = match.turnSide === state.friendRole ? "human" : "cpu";
      state.turnNumber = match.turnNumber || 1;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.animating = false;
      state.gameOver = false;
      state.matchResult = match.result ?? null;
      state.matchResultReason = match.resultReason ?? match.state?.resultReason ?? null;
      state.lastShownResultKey = null;
      hideBattleResult();
      state.log = [
        "オンライン共通戦闘画面に入りました。ゲーム状態同期を開始します。",
        "光速回路の一試合一度状態は、host・guestそれぞれの所有状態として管理されます。"
      ];
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      elements.allocationBox?.classList.remove("active");
      elements.handCardSelectionBox?.classList.remove("active");
      pendingBoardHandSelection = null;
      pendingHandCardSelection = null;
      pendingNumberAllocation = null;
      clearHighlights();
      showScreen("battle");
      if (match.state) {
        state.friendApplyingRemoteState = true;
        const snapshot = match.state;
        applyFriendSideToLocal("human", snapshot[state.friendRole]);
        applyFriendSideToLocal("cpu", snapshot[otherFriendRole()]);
        state.turn = snapshot.turnSide === state.friendRole ? "human" : "cpu";
        if(snapshot.startingPlayer==="host"||snapshot.startingPlayer==="guest"){
          state.startingPlayer=snapshot.startingPlayer;
          state.startingPlayerDecided=true;
        }
        state.turnNumber = Number(snapshot.turnNumber || 1);
        state.gameOver = !!snapshot.gameOver;
        state.matchResult = snapshot.result ?? match.result ?? null;
        state.matchResultReason = snapshot.resultReason ?? match.resultReason ?? null;
        state.log = [...(snapshot.log || [])];
        state.lastAction = snapshot.lastAction ? cloneJson(snapshot.lastAction) : null;
        state.friendApplyingRemoteState = false;
      }
      // 初回join/reconnectだけはroom snapshotを無条件の正本として復元する。
      state.friendSnapshotHydrated = true;
      setMessage(state.gameOver ? "試合終了。" : state.turn === "human" ? "あなたの番です。" : `${getPlayerDisplayName("cpu")}の番です。同期を待っています。`);
      render();
      if (state.gameOver && state.matchResult) showBattleResult(state.matchResult);
      await showFriendVsCutIn(match);
      const decidedMatch=await ensureFriendStartingPlayerDecided(match);
      const decidedSnapshot=decidedMatch?.state||{};
      state.friendTurnSerial=Number(decidedMatch?.turnSerial||decidedSnapshot.turnSerial||state.friendTurnSerial||1);
      state.friendTurnOwner=decidedMatch?.turnOwner||decidedSnapshot.turnOwner||decidedMatch?.turnSide||decidedSnapshot.turnSide||state.friendTurnOwner;
      state.friendTurnStarted=typeof decidedMatch?.turnStarted==="boolean"?decidedMatch.turnStarted:decidedSnapshot.turnStarted===true;
      state.friendTurnStartAppliedSerial=Number(decidedMatch?.turnStartAppliedSerial??decidedSnapshot.turnStartAppliedSerial??(state.friendTurnStarted?state.friendTurnSerial:Math.max(0,state.friendTurnSerial-1)));
      state.friendTurnStartToken=decidedMatch?.turnStartToken||null;
      state.friendTurnStartClaimedAtMs=friendTimestampMillis(decidedMatch?.turnStartClaimedAt);
      state.turn=state.friendTurnOwner===state.friendRole?"human":"cpu";
      const initialTurnNotStarted=state.friendTurnSerial===1&&!state.friendTurnStarted&&Number(decidedSnapshot.host?.personalTurnCount||0)===0&&Number(decidedSnapshot.guest?.personalTurnCount||0)===0;
      if(initialTurnNotStarted){
        beginFriendStartingFlow(decidedMatch).catch(error=>{console.error(error);state.startingRouletteActive=false;render();});
      }else{
        state.startingRouletteActive=false;
        render();
        if(state.turn==="human"&&state.friendTurnStartAppliedSerial<state.friendTurnSerial)await ensureFriendLocalTurnStarted();
      }
    }

    function loadRoomFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");
      if (roomId) {
        showScreen("friendLobby");
        elements.friendLobbyMessage.textContent="部屋に参加中…";
        if (firebaseApi()) joinFriendRoom(roomId);
        else window.addEventListener("waribashi-firebase-ready", () => joinFriendRoom(roomId), { once: true });
      }
    }

    function hasUnreadNews() {
      try {
        return localStorage.getItem(NEWS_STORAGE_KEY) !== LATEST_NEWS_ID;
      } catch {
        return true;
      }
    }

    function updateNewsUnreadBadge() {
      if (!elements.newsUnreadBadge) return;
      elements.newsUnreadBadge.classList.toggle("hidden", !hasUnreadNews());
    }

    function markNewsAsRead() {
      try {
        localStorage.setItem(NEWS_STORAGE_KEY, LATEST_NEWS_ID);
      } catch {}
      updateNewsUnreadBadge();
    }

    function renderFeaturedNews() {
      const featured = UPDATE_NEWS.find(item => item.featured);
      if (!featured || !elements.newsFeaturedBanner) return;
      elements.newsFeaturedBanner.innerHTML = `
        <div class="news-featured-electric" aria-hidden="true"></div>
        <div class="news-featured-label">FEATURED UPDATE</div>
        <div class="news-featured-title">${escapeHtml(featured.title)}</div>
        <div class="news-featured-summary">${escapeHtml(featured.summary)}</div>
        <div class="news-featured-meta">${escapeHtml(featured.version)} / ${escapeHtml(featured.date)}</div>
      `;
    }

    function renderNewsList(filter = "all") {
      if (!elements.newsList) return;
      const entries = UPDATE_NEWS.filter(item => filter === "all" || item.tags.includes(filter));
      elements.newsList.innerHTML = entries.map((item, index) => `
        <article class="news-entry ${item.featured ? "featured" : ""}">
          <button class="news-entry-toggle" data-news-index="${UPDATE_NEWS.indexOf(item)}" aria-expanded="${index === 0 ? "true" : "false"}">
            <div class="news-entry-topline">
              <span class="news-version">${escapeHtml(item.version)}</span>
              <span class="news-date">${escapeHtml(item.date)}</span>
            </div>
            <div class="news-entry-title">${escapeHtml(item.title)}</div>
            <div class="news-tag-row">
              ${item.tags.map(tag => `<span class="news-tag ${escapeHtml(tag)}">${escapeHtml(newsTagLabel(tag))}</span>`).join("")}
            </div>
            <div class="news-entry-summary">${escapeHtml(item.summary)}</div>
            <span class="news-expand-mark">${index === 0 ? "−" : "+"}</span>
          </button>
          <div class="news-entry-detail ${index === 0 ? "open" : ""}">
            <ul>${item.items.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
          </div>
        </article>
      `).join("");

      elements.newsList.querySelectorAll(".news-entry-toggle").forEach(button => {
        button.addEventListener("click", () => {
          const detail = button.nextElementSibling;
          const open = !detail.classList.contains("open");
          detail.classList.toggle("open", open);
          button.setAttribute("aria-expanded", String(open));
          const mark = button.querySelector(".news-expand-mark");
          if (mark) mark.textContent = open ? "−" : "+";
        });
      });
    }

    function openNews(filter = "all") {
      renderFeaturedNews();
      renderNewsList(filter);
      elements.newsFilterRow?.querySelectorAll(".news-filter").forEach(button => {
        button.classList.toggle("active", button.dataset.newsFilter === filter);
      });
      elements.newsModal?.classList.add("show");
      elements.newsModal?.setAttribute("aria-hidden", "false");
      markNewsAsRead();
    }

    function closeNews() {
      elements.newsModal?.classList.remove("show");
      elements.newsModal?.setAttribute("aria-hidden", "true");
    }

    function shouldShowMajorUpdate() {
      try {
        return localStorage.getItem(MAJOR_UPDATE_STORAGE_KEY) !== "seen";
      } catch {
        return true;
      }
    }

    function markMajorUpdateSeen() {
      try {
        localStorage.setItem(MAJOR_UPDATE_STORAGE_KEY, "seen");
      } catch {}
    }

    function openMajorUpdate() {
      elements.majorUpdateModal?.classList.add("show");
      elements.majorUpdateModal?.setAttribute("aria-hidden", "false");
    }

    function closeMajorUpdate() {
      elements.majorUpdateModal?.classList.remove("show");
      elements.majorUpdateModal?.setAttribute("aria-hidden", "true");
      markMajorUpdateSeen();
    }

    function tutorialSetWelcomeSeen(value = "seen") {
      try { localStorage.setItem(TUTORIAL_WELCOME_KEY, value); } catch {}
    }

    function shouldShowTutorialWelcome() {
      try { return localStorage.getItem(TUTORIAL_WELCOME_KEY) !== "seen"; } catch { return true; }
    }

    function showTutorialWelcome() {
      elements.tutorialWelcomeModal?.classList.add("show");
      elements.tutorialWelcomeModal?.setAttribute("aria-hidden", "false");
    }

    function closeTutorialWelcome() {
      elements.tutorialWelcomeModal?.classList.remove("show");
      elements.tutorialWelcomeModal?.setAttribute("aria-hidden", "true");
    }

    function showMajorUpdateAfterTutorialWelcome() {
      if (shouldShowMajorUpdate()) setTimeout(() => openMajorUpdate(), 220);
    }

    function renderTutorialChapterList() {
      const progress = loadTutorialProgress();
      elements.tutorialChapterList.innerHTML = TUTORIAL_CHAPTERS.map(chapter => `
        <button class="tutorial-chapter-card ${progress.completed.includes(chapter.id) ? "complete" : ""}" data-tutorial-chapter="${chapter.id}">
          <span class="tutorial-chapter-number">第${chapter.id}章</span>
          <strong>${escapeHtml(chapter.title)}</strong>
          <span>${escapeHtml(chapter.subtitle)}</span>
          <em>${progress.completed.includes(chapter.id) ? "クリア済み" : chapter.id === progress.lastChapter ? "続きから" : "開始"}</em>
        </button>
      `).join("");
      elements.tutorialChapterList.querySelectorAll("[data-tutorial-chapter]").forEach(button => {
        button.addEventListener("click", () => startTutorialChapter(Number(button.dataset.tutorialChapter)));
      });
    }

    function openTutorialMenu() {
      showScreen("tutorial");
      elements.tutorialStage.classList.add("hidden");
      elements.tutorialChapterList.classList.remove("hidden");
      elements.tutorialChapterTitle.textContent = "チュートリアル";
      elements.tutorialChapterSubtitle.textContent = "全5章です。クリア済みの章も何度でも遊べます。";
      renderTutorialChapterList();
    }

    function tutorialSetHands(hL, hR, cL, cR) {
      const values = { humanL: hL, humanR: hR, cpuL: cL, cpuR: cR };
      for (const [key, value] of Object.entries(values)) {
        const element = {
          humanL: elements.tutorialHumanL, humanR: elements.tutorialHumanR,
          cpuL: elements.tutorialCpuL, cpuR: elements.tutorialCpuR
        }[key];
        element.querySelector("strong").textContent = value;
        element.dataset.value = value;
        element.classList.toggle("zero", value === 0);
      }
    }

    function tutorialClearHighlights() {
      [
        elements.tutorialHumanL, elements.tutorialHumanR,
        elements.tutorialCpuL, elements.tutorialCpuR,
        elements.tutorialSplitBtn, elements.tutorialNextBtn
      ].forEach(element => element?.classList.remove("tutorial-target"));
      elements.tutorialHandCards.querySelectorAll(".tutorial-card").forEach(card => card.classList.remove("tutorial-target"));
      elements.tutorialHumanAttachments.querySelectorAll("*").forEach(el => el.classList.remove("tutorial-target"));
      elements.tutorialCpuAttachments.querySelectorAll("*").forEach(el => el.classList.remove("tutorial-target"));
    }

    function tutorialHighlight(target) {
      tutorialClearHighlights();
      target?.classList.add("tutorial-target");
    }

    function tutorialMessage(title, text, calculation = "") {
      elements.tutorialMessageTitle.textContent = title;
      elements.tutorialMessageText.innerHTML = text;
      elements.tutorialCalculation.textContent = calculation || "操作してください";
    }

    function tutorialCards(cardIds) {
      elements.tutorialHandCards.innerHTML = cardIds.map(cardId => {
        const card = TUTORIAL_CARD_INFO[cardId];
        return `<button class="tutorial-card" data-tutorial-card="${cardId}">
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.type)}</span>
          <small>${escapeHtml(card.text)}</small>
        </button>`;
      }).join("");
      elements.tutorialHandCards.querySelectorAll("[data-tutorial-card]").forEach(card => {
        card.addEventListener("click", () => tutorialHandleCard(card.dataset.tutorialCard, card));
      });
    }

    function tutorialAttachment(owner, hand, name, kind, hidden = false) {
      const container = owner === "human" ? elements.tutorialHumanAttachments : elements.tutorialCpuAttachments;
      const chip = document.createElement("div");
      chip.className = `tutorial-attachment ${kind}`;
      chip.dataset.hand = hand;
      chip.textContent = hidden ? "裏向きの罠" : `${hand === "L" ? "左手" : "右手"}：${name}`;
      container.appendChild(chip);
      return chip;
    }

    function tutorialResetStage() {
      tutorial.selectedAttackHand = null;
      tutorial.chapterComplete = false;
      elements.tutorialHumanAttachments.innerHTML = "";
      elements.tutorialCpuAttachments.innerHTML = "";
      elements.tutorialHandCards.innerHTML = "";
      elements.tutorialSplitPanel.classList.add("hidden");
      elements.tutorialChoicePanel.classList.add("hidden");
      elements.tutorialNextBtn.classList.add("hidden");
      elements.tutorialSplitBtn.classList.remove("hidden");
      tutorialClearHighlights();
    }

    function startTutorialChapter(chapter) {
      tutorial.chapter = chapter;
      tutorial.step = 0;
      saveTutorialProgress(chapter, false);
      elements.tutorialChapterList.classList.add("hidden");
      elements.tutorialStage.classList.remove("hidden");
      const info = TUTORIAL_CHAPTERS.find(item => item.id === chapter);
      elements.tutorialChapterTitle.textContent = `第${chapter}章　${info.title}`;
      elements.tutorialChapterSubtitle.textContent = info.subtitle;
      tutorialResetStage();
      renderTutorialStep();
    }

    function tutorialProgress(total) {
      elements.tutorialProgressText.textContent = `${tutorial.step + 1} / ${total}`;
      elements.tutorialProgressFill.style.width = `${Math.min(100, ((tutorial.step + 1) / total) * 100)}%`;
    }

    function tutorialAdvance() {
      tutorial.step += 1;
      renderTutorialStep();
    }

    function tutorialCompleteChapter() {
      tutorial.chapterComplete = true;
      saveTutorialProgress(tutorial.chapter, true);
      const nextChapter = tutorial.chapter + 1;
      tutorialMessage(
        `第${tutorial.chapter}章クリア！`,
        nextChapter <= 5
          ? `基本を一つ覚えました。<br>「次へ」を押すと第${nextChapter}章へ進みます。`
          : `全5章をクリアしました！<br>これで通常対戦を始めるための基本はばっちりです。`,
        "CLEAR"
      );
      elements.tutorialNextBtn.textContent = nextChapter <= 5 ? "次の章へ" : "章一覧へ";
      elements.tutorialNextBtn.classList.remove("hidden");
      tutorialHighlight(elements.tutorialNextBtn);
      renderTutorialChapterList();
    }

    function renderTutorialStep() {
      tutorialClearHighlights();
      elements.tutorialChoicePanel.classList.add("hidden");
      elements.tutorialSplitPanel.classList.add("hidden");
      elements.tutorialNextBtn.classList.add("hidden");
      elements.tutorialSplitBtn.classList.add("hidden");

      if (tutorial.chapter === 1) {
        tutorialProgress(7);
        if (tutorial.step === 0) {
          tutorialSetHands(1, 1, 1, 1); tutorialCards([]);
          tutorialMessage("攻撃する手を選ぶ", "まず、自分の右手を選んでください。");
          tutorialHighlight(elements.tutorialHumanR);
        } else if (tutorial.step === 1) {
          tutorialMessage("攻撃する相手を選ぶ", "次に、相手の左手を選びます。<br>自分の手の本数を相手へ足します。", "1 ＋ 1 ＝ 2");
          tutorialHighlight(elements.tutorialCpuL);
        } else if (tutorial.step === 2) {
          tutorialSetHands(1, 1, 4, 1);
          tutorialMessage("5になった手は0", "相手の左手は4です。まず自分の右手を選んでください。", "4 ＋ 1 ＝ 5 → 0");
          tutorial.selectedAttackHand = null;
          tutorialHighlight(elements.tutorialHumanR);
        } else if (tutorial.step === 3) {
          tutorialMessage("ちょうど5を作る", "相手の左手を選んで攻撃してください。<br>合計が5になった手は0になります。", "4 ＋ 1 ＝ 5 → 0");
          tutorialHighlight(elements.tutorialCpuL);
        } else if (tutorial.step === 4) {
          tutorialSetHands(3, 1, 4, 1);
          tutorialMessage("超過した分が残る", "次は自分の左手3を選んでください。", "4 ＋ 3 ＝ 7 → 2");
          tutorial.selectedAttackHand = null;
          tutorialHighlight(elements.tutorialHumanL);
        } else if (tutorial.step === 5) {
          tutorialMessage("7は2になる", "相手の左手を選んで攻撃してください。<br>合計7から5を引いた余りの2が残ります。", "4 ＋ 3 ＝ 7 → 2");
          tutorialHighlight(elements.tutorialCpuL);
        } else {
          tutorialCompleteChapter();
        }
        return;
      }

      if (tutorial.chapter === 2) {
        tutorialProgress(3);
        if (tutorial.step === 0) {
          tutorialSetHands(2, 0, 3, 2); tutorialCards([]);
          elements.tutorialSplitBtn.classList.remove("hidden");
          tutorialMessage("このままでは負ける", "相手の3で自分の2を攻撃されると、2＋3＝5で両手が0になります。<br>「分ける」を押してください。", "2 ＋ 3 ＝ 5 → 敗北");
          tutorialHighlight(elements.tutorialSplitBtn);
        } else if (tutorial.step === 1) {
          elements.tutorialSplitPanel.classList.remove("hidden");
          tutorialMessage("2・0を1・1にする", "合計本数を変えず、左右へ1本ずつ分けます。<br>「1・1に分ける」を選んでください。");
        } else {
          tutorialSetHands(1, 1, 3, 2);
          tutorialMessage("分けたターンは攻撃できない", "分けるとそのターンは攻撃できません。<br>攻撃をあきらめる代わりに、片方を倒されてももう片方が残る形にできます。", "分ける または 攻撃");
          elements.tutorialNextBtn.textContent = "理解した";
          elements.tutorialNextBtn.classList.remove("hidden");
          tutorialHighlight(elements.tutorialNextBtn);
        }
        return;
      }

      if (tutorial.chapter === 3) {
        tutorialProgress(8);
        if (tutorial.step === 0) {
          tutorialSetHands(1,1,1,1); tutorialCards(["inspiration"]);
          tutorialMessage("カードを使ってみる", "「ひらめき」はカードを1枚引く、シンプルなカードです。押して使ってください。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="inspiration"]'));
        } else if (tutorial.step === 1) {
          tutorialCards(["strongHit"]);
          tutorialSetHands(1,0,3,0);
          tutorialMessage("そのままでは倒せない", "1で3を攻撃すると相手は4になり、倒せません。<br>先に「強打」を使って攻撃する本数を＋1してください。", "3 ＋ 1 ＝ 4");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="strongHit"]'));
        } else if (tutorial.step === 2) {
          tutorialMessage("強打して攻撃", "強打で1本増え、攻撃は2本になります。<br>自分の左手を選んでください。", "3 ＋ (1＋1) ＝ 5 → 0");
          tutorialHighlight(elements.tutorialHumanL);
        } else if (tutorial.step === 3) {
          tutorialMessage("相手を倒す", "相手の左手を選んで、ちょうど5にしてください。", "3 ＋ 2 ＝ 5 → 0");
          tutorialHighlight(elements.tutorialCpuL);
        } else if (tutorial.step === 4) {
          tutorialCards(["lightHit"]); tutorialSetHands(3,0,3,0);
          tutorialMessage("強すぎる攻撃は超過する", "3で3を攻撃すると6→1になり、倒せません。<br>「軽打」で攻撃する本数を1減らしてください。", "3 ＋ 3 ＝ 6 → 1");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="lightHit"]'));
        } else if (tutorial.step === 5) {
          tutorialMessage("軽打して攻撃", "攻撃する本数は2になりました。自分の左手を選んでください。", "3 ＋ (3－1) ＝ 5 → 0");
          tutorialHighlight(elements.tutorialHumanL);
        } else if (tutorial.step === 6) {
          tutorialMessage("ちょうど5を作る", "相手の左手を選んで倒しましょう。", "3 ＋ 2 ＝ 5 → 0");
          tutorialHighlight(elements.tutorialCpuL);
        } else if (tutorial.step === 7) {
          tutorialCards(["pass"]); tutorialSetHands(1,1,1,1);
          tutorialMessage("終端カード", "一部のカードには「終端」と書かれています。<br>使うと、その時点でターンが終了します。「パス」を使ってみましょう。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="pass"]'));
        } else {
          tutorialCompleteChapter();
        }
        return;
      }

      if (tutorial.chapter === 4) {
        tutorialProgress(7);
        if (tutorial.step === 0) {
          tutorialSetHands(1,1,2,1); tutorialCards(["miss"]);
          tutorialMessage("手動罠を置く", "「空振り」を自分の左手に設置します。まずカードを押してください。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="miss"]'));
        } else if (tutorial.step === 1) {
          tutorialMessage("設置する手を選ぶ", "罠を置く自分の左手を選んでください。");
          tutorialHighlight(elements.tutorialHumanL);
        } else if (tutorial.step === 2) {
          elements.tutorialChoicePanel.classList.remove("hidden");
          tutorialMessage("手動で発動を選ぶ", "相手が左手を攻撃してきました。<br>空振りは手動罠なので、発動するか選べます。");
        } else if (tutorial.step === 3) {
          tutorialCards(["thorns"]); tutorialSetHands(1,1,2,1);
          tutorialMessage("自動罠を置く", "次は「茨」を自分の右手に設置します。カードを押してください。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="thorns"]'));
        } else if (tutorial.step === 4) {
          tutorialMessage("設置する手を選ぶ", "茨を置く自分の右手を選んでください。");
          tutorialHighlight(elements.tutorialHumanR);
        } else if (tutorial.step === 5) {
          tutorialMessage("茨は自動発動", "相手が右手を攻撃すると、茨は確認なしで自動発動します。<br>攻撃した相手の手に＋1しました。", "相手の手 2 → 3");
          elements.tutorialNextBtn.textContent = "次へ";
          elements.tutorialNextBtn.classList.remove("hidden");
          tutorialHighlight(elements.tutorialNextBtn);
        } else {
          tutorialCompleteChapter();
        }
        return;
      }

      if (tutorial.chapter === 5) {
        tutorialProgress(6);
        if (tutorial.step === 0) {
          tutorialSetHands(1,1,2,2); tutorialCards(["powerBlessing"]);
          tutorialMessage("加護を置く", "加護は自分の手に付けて、良い効果を継続させます。<br>「力の加護」を押してください。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="powerBlessing"]'));
        } else if (tutorial.step === 1) {
          tutorialMessage("自分の手に設置", "力の加護を自分の左手に付けてください。");
          tutorialHighlight(elements.tutorialHumanL);
        } else if (tutorial.step === 2) {
          tutorialCards(["sluggishCurse"]);
          tutorialMessage("呪縛を置く", "呪縛は相手の手に付けて、不利な効果を継続させます。<br>「鈍重の呪縛」を押してください。");
          tutorialHighlight(elements.tutorialHandCards.querySelector('[data-tutorial-card="sluggishCurse"]'));
        } else if (tutorial.step === 3) {
          tutorialMessage("相手の手に設置", "鈍重の呪縛を相手の左手に付けてください。");
          tutorialHighlight(elements.tutorialCpuL);
        } else if (tutorial.step === 4) {
          tutorialMessage("罠との違い", "罠は条件を満たすと発動し、多くは一度で捨て札へ行きます。<br>加護と呪縛は場に残り、継続して効果を与えます。<br><strong>ただし、付いている手が0になると消えます。</strong>", "加護＝自分　呪縛＝相手");
          elements.tutorialNextBtn.textContent = "理解した";
          elements.tutorialNextBtn.classList.remove("hidden");
          tutorialHighlight(elements.tutorialNextBtn);
        } else {
          tutorialCompleteChapter();
        }
      }
    }

    function tutorialHandleHand(owner, hand, element) {
      if (tutorial.chapter === 1) {
        if ([0, 2, 4].includes(tutorial.step)) {
          const expected = tutorial.step === 4 ? "L" : "R";
          if (owner !== "human" || hand !== expected) return;
          tutorial.selectedAttackHand = hand;
          tutorialAdvance();
          return;
        }
        if ([1, 3, 5].includes(tutorial.step)) {
          if (owner !== "cpu" || hand !== "L") return;
          if (tutorial.step === 1) tutorialSetHands(1, 1, 2, 1);
          if (tutorial.step === 3) tutorialSetHands(1, 1, 0, 1);
          if (tutorial.step === 5) tutorialSetHands(3, 1, 2, 1);
          tutorialAdvance();
          return;
        }
      }

      if (tutorial.chapter === 3) {
        if ([2,5].includes(tutorial.step) && owner === "human" && hand === "L") {
          tutorial.selectedAttackHand = hand; tutorialAdvance(); return;
        }
        if ([3,6].includes(tutorial.step) && owner === "cpu" && hand === "L") {
          tutorialSetHands(
            tutorial.step === 3 ? 1 : 3, 0, 0, 0
          );
          tutorialAdvance(); return;
        }
      }

      if (tutorial.chapter === 4) {
        if (tutorial.step === 1 && owner === "human" && hand === "L") {
          tutorialAttachment("human", "L", "空振り", "trap", false);
          tutorialAdvance(); return;
        }
        if (tutorial.step === 4 && owner === "human" && hand === "R") {
          tutorialAttachment("human", "R", "茨", "trap", false);
          tutorialAdvance(); return;
        }
      }

      if (tutorial.chapter === 5) {
        if (tutorial.step === 1 && owner === "human" && hand === "L") {
          tutorialAttachment("human", "L", "力の加護", "blessing", false);
          tutorialAdvance(); return;
        }
        if (tutorial.step === 3 && owner === "cpu" && hand === "L") {
          tutorialAttachment("cpu", "L", "鈍重の呪縛", "curse", false);
          tutorialAdvance(); return;
        }
      }
    }

    function tutorialHandleCard(cardId, element) {
      const expectedByStep = {
        "3:0": "inspiration", "3:1": "strongHit", "3:4": "lightHit", "3:7": "pass",
        "4:0": "miss", "4:3": "thorns",
        "5:0": "powerBlessing", "5:2": "sluggishCurse"
      };
      const expected = expectedByStep[`${tutorial.chapter}:${tutorial.step}`];
      if (cardId !== expected) return;

      if (cardId === "inspiration") {
        tutorialCards(["strongHit"]);
        tutorialMessage("カードを引けた", "ひらめきで新しいカードを1枚引きました。<br>カードを使うと、多くの場合は捨て札へ送られます。", "手札 ＋1");
        elements.tutorialNextBtn.textContent = "次へ";
        elements.tutorialNextBtn.classList.remove("hidden");
        tutorialHighlight(elements.tutorialNextBtn);
        return;
      }

      if (["strongHit","lightHit","miss","thorns","powerBlessing","sluggishCurse"].includes(cardId)) {
        tutorialAdvance();
        return;
      }

      if (cardId === "pass") {
        tutorialMessage("ターン終了", "終端カードを使ったため、このターンはもう攻撃や分けるができません。", "TURN END");
        elements.tutorialNextBtn.textContent = "章を終える";
        elements.tutorialNextBtn.classList.remove("hidden");
        tutorialHighlight(elements.tutorialNextBtn);
      }
    }


    function clearRealTutorialTargets() {
      document.querySelectorAll(".real-tutorial-target").forEach(el => el.classList.remove("real-tutorial-target"));
    }

    function realTutorialTarget(selector) {
      clearRealTutorialTargets();
      const el = typeof selector === "string" ? document.querySelector(selector) : selector;
      el?.classList.add("real-tutorial-target");
    }

    function setRealTutorialGuide(text, expected, progress, total) {
      tutorial.expected = expected;
      document.body.classList.toggle(
        "tutorial-split-only",
        isTutorialBattle() && (expected === "split" || expected === "confirmSplit")
      );
      elements.realTutorialText.innerHTML = text;
      elements.realTutorialProgressFill.style.width = `${Math.max(0, Math.min(100, progress / total * 100))}%`;
      elements.realTutorialOkBtn?.classList.toggle("hidden", expected !== "ok");
      setMessage(text.replace(/<[^>]*>/g, ""));
      clearRealTutorialTargets();

      if (expected === "humanL") realTutorialTarget("#humanL");
      if (expected === "humanR") realTutorialTarget("#humanR");
      if (expected === "cpuL") realTutorialTarget("#cpuL");
      if (expected === "cpuR") realTutorialTarget("#cpuR");
      if (expected === "split") realTutorialTarget("#splitBtn");
      if (expected === "confirmSplit") realTutorialTarget("#confirmSplitBtn");
      if (expected === "ok") realTutorialTarget("#realTutorialOkBtn");
      if (expected?.startsWith("card:")) {
        const cardId = expected.slice(5);
        const index = state.hands.human.indexOf(cardId);
        if (index >= 0) realTutorialTarget(elements.humanCards.children[index]);
      }
    }

    function isTutorialBattle() {
      return state.battleMode === "tutorial" && state.tutorialBattleActive === true;
    }

    function freezeTutorialBattleToHumanTurn() {
      state.turn = "human";
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingSwapFirst = null;
      state.pendingTerminalEnd.human = false;
      state.pendingTerminalEnd.cpu = false;
      state.gameOver = false;
      state.matchResult = null;
      state.matchResultReason = null;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      render();
    }

    function setupRealTutorialBase(chapter) {
      tutorial.usingRealBattle = true;
      tutorial.chapter = chapter;
      tutorial.step = 0;
      tutorial.chapterComplete = false;
      tutorial.selectedAttackHand = null;
      tutorial.cardUsed = null;

      state.battleMode = "tutorial";
      state.tutorialBattleActive = true;
      state.tutorialScriptedCpuAction = false;
      handNames.cpu = "練習CPU";
      showScreen("battle");
      resetGame();
      state.battleMode = "tutorial";
      state.tutorialBattleActive = true;
      state.tutorialScriptedCpuAction = false;
      state.turn = "human";
      state.gameOver = false;
      state.animating = false;
      state.mode = "attack";
      state.hands.human = [];
      state.hands.cpu = [];
      moveThemeSettingToOpeningHand("human");
      moveThemeSettingToOpeningHand("cpu");
      state.decks.human = [];
      state.decks.cpu = [];
      state.discard.human = [];
      state.discard.cpu = [];
      state.cardInstanceSequence=0;state.handCardInstances={human:[],cpu:[]};state.cardLocks={human:[],cpu:[]};state.forcedCard={human:null,cpu:null};state.nobleGasProtected={human:false,cpu:false};state.pendingLateAttackBonus={human:0,cpu:0};state.copiedEffectDepth=0;
      state.traps.human = { L: [], R: [] };
      state.traps.cpu = { L: [], R: [] };
      state.temp.human.cardActionUsed = false;
      state.temp.cpu.cardActionUsed = false;

      elements.realTutorialOverlay.classList.remove("hidden");
      const info = TUTORIAL_CHAPTERS.find(item => item.id === chapter);
      elements.realTutorialChapter.textContent = `第${chapter}章`;
      elements.realTutorialTitle.textContent = info.title;
      render();
      renderRealTutorialStep();
    }

    function startTutorialChapter(chapter) {
      saveTutorialProgress(chapter, false);
      setupRealTutorialBase(chapter);
    }

    function realTutorialHands(hL,hR,cL,cR) {
      state.human.L=hL; state.human.R=hR; state.cpu.L=cL; state.cpu.R=cR;
      state.selectedAttackHand=null; state.mode="attack"; state.turn="human";
      state.temp.human.cardActionUsed=false;
      state.temp.human.attackBonus=0;
      state.pendingTerminalEnd.human=false;
      render();
    }

    function realTutorialCards(ids) {
      state.hands.human=[...ids];
      state.temp.human.cardActionUsed=false;
      render();
    }

    function finishRealTutorialChapter() {
      tutorial.chapterComplete = true;
      saveTutorialProgress(tutorial.chapter, true);
      clearRealTutorialTargets();
      elements.realTutorialOkBtn?.classList.add("hidden");
      elements.realTutorialText.innerHTML =
        tutorial.chapter < 5
          ? `第${tutorial.chapter}章クリア！ ホームの章一覧から次の章へ進めます。`
          : "全5章クリア！ 基本ルールを覚えました。";
      elements.realTutorialProgressFill.style.width = "100%";
      setMessage("チュートリアルをクリアしました。章一覧へ戻れます。");
    }

    function renderRealTutorialStep() {
      const ch=tutorial.chapter, st=tutorial.step;
      if(ch===1){
        const total=5;
        if(st===0){
          realTutorialHands(1,1,1,1);
          realTutorialCards([]);
          setRealTutorialGuide("自分も相手も1・1で始まります。まず自分の右手を選んでください。","humanR",1,total);
        }
        else if(st===1){
          setRealTutorialGuide("相手の左手を選んで攻撃します。相手の左手は1＋1＝2になります。","cpuL",2,total);
        }
        else if(st===2){
          setRealTutorialGuide("練習CPUが左手2で、あなたの右手1を攻撃しました。盤面は自分1・3、相手2・1です。自分の右手3を選んでください。","humanR",3,total);
        }
        else if(st===3){
          setRealTutorialGuide("相手の左手2を選びます。2＋3＝5なので、その手は0になります。","cpuL",4,total);
        }
        else finishRealTutorialChapter();
      } else if(ch===2){
        const total=5;
        if(st===0){
          realTutorialHands(2,0,3,2);
          realTutorialCards([]);
          setRealTutorialGuide("このままでは相手の3で自分の2を5にされて負けます。「分ける」を押してください。","split",1,total);
        }
        else if(st===1){
          elements.splitLeft.value="1";
          elements.splitRight.value="1";
          setRealTutorialGuide("分け直し欄を1・1にし、「決定」を押してください。","confirmSplit",2,total);
        }
        else if(st===2){
          setRealTutorialGuide(
            "分けたターンは攻撃できません。<br><strong>攻撃か分けるのどちらか一方</strong>を選ぶルールです。",
            "ok",3,total
          );
        }
        else if(st===3){
          setRealTutorialGuide(
            "分ける前と後で、左右の<strong>合計本数は変えられません</strong>。また、分けた結果として片方を0にする形にはできません。<br>例：2・0→1・1は可能ですが、2・1→3・0のように片方を0にする分け方はできません。",
            "ok",4,total
          );
        }
        else finishRealTutorialChapter();
      } else if(ch===3){
        const total=10;
        if(st===0){ realTutorialHands(1,1,1,1); state.decks.human=["strongHit"]; realTutorialCards(["insight"]); setRealTutorialGuide("実際の手札UIです。「ひらめき」を使って1枚引きましょう。","card:insight",1,total); }
        else if(st===1){ realTutorialHands(1,0,3,0); realTutorialCards(["strongHit"]); setRealTutorialGuide("1で3を殴るだけでは4です。「強打」を使って攻撃を＋1してください。","card:strongHit",2,total); }
        else if(st===2){ setRealTutorialGuide("自分の左手1を選びます。強打により2として攻撃します。","humanL",3,total); }
        else if(st===3){ setRealTutorialGuide("相手の左手3を選び、3＋2＝5で倒しましょう。","cpuL",4,total); }
        else if(st===4){ realTutorialHands(3,0,3,0); realTutorialCards(["lightHit"]); setRealTutorialGuide("3で3を殴ると6→1です。「軽打」を使って攻撃を－1してください。","card:lightHit",5,total); }
        else if(st===5){ setRealTutorialGuide("自分の左手3を選びます。軽打により2として攻撃します。","humanL",6,total); }
        else if(st===6){ setRealTutorialGuide("相手の左手3を選び、3＋2＝5で倒しましょう。","cpuL",7,total); }
        else if(st===7){ realTutorialHands(1,1,1,1); realTutorialCards(["passCard"]); setRealTutorialGuide("「終端」のパスを使ってください。使った時点でターンが終了します。","card:passCard",8,total); }
        else finishRealTutorialChapter();
      } else if(ch===4){
        const total=8;
        if(st===0){ realTutorialHands(1,1,2,1); realTutorialCards(["dodgeTrap"]); setRealTutorialGuide("「空振り」を押し、実際の罠設置モードにしてください。","card:dodgeTrap",1,total); }
        else if(st===1){ setRealTutorialGuide("空振りを自分の左手に置いてください。","humanL",2,total); }
        else if(st===2){
          setRealTutorialGuide("練習CPUが左手を攻撃します。実際の手動罠確認で「発動する」を選んでください。",null,3,total);
          setTimeout(async()=>{
            if (!isTutorialBattle()) return;
            state.tutorialScriptedCpuAction = true;
            state.turn="cpu";
            render();
            await attack("cpu","L","human","L");
            state.tutorialScriptedCpuAction = false;
            freezeTutorialBattleToHumanTurn();
          },350);
        }
        else if(st===3){ realTutorialHands(1,1,2,1); realTutorialCards(["thornTrap"]); setRealTutorialGuide("次は「茨」を押してください。","card:thornTrap",4,total); }
        else if(st===4){ setRealTutorialGuide("茨を自分の右手に置いてください。","humanR",5,total); }
        else if(st===5){
          setRealTutorialGuide("練習CPUが右手を攻撃します。茨は確認なしで自動発動します。",null,6,total);
          setTimeout(async()=>{
            if (!isTutorialBattle()) return;
            state.tutorialScriptedCpuAction = true;
            state.turn="cpu";
            render();
            await attack("cpu","L","human","R");
            state.tutorialScriptedCpuAction = false;
            freezeTutorialBattleToHumanTurn();
            tutorial.step++;
            renderRealTutorialStep();
          },350);
        }
        else finishRealTutorialChapter();
      } else if(ch===5){
        const total=8;
        if(st===0){
          realTutorialHands(1,1,2,2);
          realTutorialCards(["powerBlessing"]);
          setRealTutorialGuide("「力の加護」を押してください。","card:powerBlessing",1,total);
        }
        else if(st===1){
          setRealTutorialGuide("力の加護を自分の左手へ置いてください。","humanL",2,total);
        }
        else if(st===2){
          state.temp.human.cardActionUsed=false;
          realTutorialCards(["slowCurse"]);
          setRealTutorialGuide("次に「鈍重の呪縛」を押してください。","card:slowCurse",3,total);
        }
        else if(st===3){
          setRealTutorialGuide("鈍重の呪縛を相手の左手へ置いてください。","cpuL",4,total);
        }
        else if(st===4){
          setRealTutorialGuide(
            "<strong>加護</strong>は自分の手に付け、良い効果を継続させます。<br><strong>呪縛</strong>は相手の手に付け、不利な効果を継続させます。どちらも相手から名前が見えます。",
            "ok",5,total
          );
        }
        else if(st===5){
          setRealTutorialGuide(
            "<strong>罠</strong>は自分の手へ裏向きで置かれ、相手には種類が分かりません。条件を満たした時に発動し、多くは一度発動すると捨て札へ行きます。",
            "ok",6,total
          );
        }
        else if(st===6){
          setRealTutorialGuide(
            "罠・加護・呪縛は、付いている手が0になると一緒に消えます。<br>どの手に付けるかも重要な判断になります。",
            "ok",7,total
          );
        }
        else finishRealTutorialChapter();
      }
    }

    function tutorialExpectedHand(owner, hand) {
      if(!tutorial.usingRealBattle || !isTutorialBattle()) return true;
      const map={humanL:["human","L"],humanR:["human","R"],cpuL:["cpu","L"],cpuR:["cpu","R"]};
      const exp=map[tutorial.expected];

      if(!exp){
        setMessage(
          tutorial.expected === "split" || tutorial.expected === "confirmSplit"
            ? "この課題では攻撃できません。黄色く光っている「分ける」の操作をしてください。"
            : tutorial.expected?.startsWith("card:")
              ? "今は黄色く光っているカードを使ってください。"
              : tutorial.expected === "ok"
                ? "説明を確認して、画面上部の「OK」を押してください。"
                : "今は説明に従ってください。"
        );
        return false;
      }

      if(exp[0]===owner && exp[1]===hand) return true;
      setMessage("今は黄色く光っている手だけを選んでください。");
      return false;
    }

    function tutorialAfterHandClick(owner,hand) {
      if(!tutorial.usingRealBattle || !isTutorialBattle()) return;
      const expected=tutorial.expected;
      const expectedMap={humanL:["human","L"],humanR:["human","R"],cpuL:["cpu","L"],cpuR:["cpu","R"]};
      const exp=expectedMap[expected];
      if(!exp || exp[0]!==owner || exp[1]!==hand) return;

      if(tutorial.chapter===1 && tutorial.step===1 && owner==="cpu" && hand==="L"){
        setTimeout(async()=>{
          if(!isTutorialBattle()) return;
          state.tutorialScriptedCpuAction=true;
          state.turn="cpu";
          render();
          await attack("cpu","L","human","R");
          state.tutorialScriptedCpuAction=false;
          freezeTutorialBattleToHumanTurn();

          state.human.L=1;
          state.human.R=3;
          state.cpu.L=2;
          state.cpu.R=1;
          render();

          tutorial.step=2;
          renderRealTutorialStep();
        },900);
        return;
      }

      const isCardAttackTarget =
        tutorial.chapter === 3 &&
        ((tutorial.step === 3 && owner === "cpu" && hand === "L") ||
         (tutorial.step === 6 && owner === "cpu" && hand === "L"));

      setTimeout(()=>{
        if(!isTutorialBattle()) return;
        tutorial.step++;
        renderRealTutorialStep();

        // 強打・軽打の撃破演出が遅れて盤面を書き戻さないよう、
        // 次の課題の固定盤面を演出完了後にも再適用する。
        if (tutorial.chapter === 3 && tutorial.step === 4) {
          setTimeout(() => {
            if (!isTutorialBattle() || tutorial.chapter !== 3 || tutorial.step !== 4) return;
            realTutorialHands(3,0,3,0);
            realTutorialCards(["lightHit"]);
            setRealTutorialGuide(
              "3で3を殴ると6→1です。「軽打」を使って攻撃を－1してください。",
              "card:lightHit",5,10
            );
          }, 350);
        }
        if (tutorial.chapter === 3 && tutorial.step === 7) {
          setTimeout(() => {
            if (!isTutorialBattle() || tutorial.chapter !== 3 || tutorial.step !== 7) return;
            realTutorialHands(1,1,1,1);
            realTutorialCards(["passCard"]);
            setRealTutorialGuide(
              "「終端」のパスを使ってください。使った時点でターンが終了します。",
              "card:passCard",8,10
            );
          }, 350);
        }
      }, isCardAttackTarget ? 1500 : 700);
    }

    function tutorialAfterCard(cardId) {
      if(!tutorial.usingRealBattle || !isTutorialBattle()) return;
      if(tutorial.expected!==`card:${cardId}`) return;
      const expectedStep=tutorial.step;
      setTimeout(()=>{
        if(!isTutorialBattle() || tutorial.step!==expectedStep) return;
        tutorial.step++;
        renderRealTutorialStep();
      },650);
    }

    function showScreen(screen) {
      state.currentScreen = screen;
      const showMenu = screen === "menu";
      const showBattleSelect = screen === "battleSelect";
      const showFriendLobby = screen === "friendLobby";
      const showDifficulty = screen === "difficulty";
      const showSettings = screen === "settings";
      const showTutorial = screen === "tutorial";
      const showDeck = screen === "deck";
      const showBattle = screen === "battle";

      elements.menuScreen.classList.toggle("screen-hidden", !showMenu);
      elements.battleSelectScreen.classList.toggle("screen-hidden", !showBattleSelect);
      elements.friendLobbyScreen.classList.toggle("screen-hidden", !showFriendLobby);
      elements.difficultyScreen.classList.toggle("screen-hidden", !showDifficulty);
      elements.settingsScreen.classList.toggle("screen-hidden", !showSettings);
      elements.tutorialScreen.classList.toggle("screen-hidden", !showTutorial);
      elements.deckEditorScreen.classList.toggle("screen-hidden", !showDeck);
      document.querySelectorAll(".battle-screen").forEach(el => {
        el.classList.toggle("screen-hidden", !showBattle);
      });

      document.body.classList.toggle("deck-mode", showDeck);
      document.body.classList.toggle("battle-mode", showBattle);
      document.body.classList.toggle("tutorial-mode", showTutorial);
      if (!showBattle && elements.realTutorialOverlay) elements.realTutorialOverlay.classList.add("hidden");
      if(showFriendLobby)updateFriendAuthUi();

      if (showDeck) {
        elements.deckPanel.classList.add("show");
        elements.deckBottomBar.classList.remove("hidden");
        renderDeckBuilder();
        setMessage("デッキ編集画面です。対戦を始める場合はメニューからスタートを選んでください。");
      } else {
        elements.deckBottomBar.classList.add("hidden");
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function startBattleWithDifficulty(difficulty) {
      const selectedRuleId=elements.cpuRegulationSelect?.value||"standard";
      const selectedRule=REGULATION_DEFS[selectedRuleId]||REGULATION_DEFS.standard;
      const humanRuleError=ruleDeckValidationMessage(selectedRule.id,currentDeckCounts("human"));
      const cpuRuleError=ruleDeckValidationMessage(selectedRule.id,currentDeckCounts("cpu"));
      if(humanRuleError||cpuRuleError){
        state.deckRuleContext={ruleId:selectedRule.id};
        state.editingDeckOwner=humanRuleError?"human":"cpu";
        showScreen("deck");
        setMessage(humanRuleError||`CPU用デッキ：${cpuRuleError}`);
        return;
      }
      if (!areBothDecksValid()) {
        const h = getDeckStats("human");
        const c = getDeckStats("cpu");
        showScreen("deck");
        if (h.count !== DECK_MAX_COUNT || c.count !== DECK_MAX_COUNT) setMessage(`対戦前に、あなた用・CPU用の両方をちょうど${DECK_MAX_COUNT}枚にしてください。`);
        else setMessage("対戦前に、あなた用・CPU用のどちらかのコストを40以内にしてください。");
        return;
      }
      state.battleMode = "cpu";
      state.friendRoomData=null;
      state.currentRegulation=regulationSnapshot(selectedRule.id);
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      tutorial.usingRealBattle = false;
      elements.realTutorialOverlay?.classList.add("hidden");
      handNames.cpu = "CPU";
      state.cpuDifficulty = difficulty;
      elements.cpuDifficultySelect.value = difficulty;
      showScreen("battle");
      const labels = { easy: "やさしめ", standard: "標準", hard: "強め" };
      setMessage(`CPU難易度「${labels[difficulty]}」で試合を準備しています。`);
      await resetGame();
    }

function wrapFinger(value) {
      return value % 5;
    }

    function normalize(value, player = null, hand = null) {
      if (value >= 5) {
        if (value >= 7 && player && hand && hasAttachment(player, hand, "overflowCurse")) {
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
    function extractThemeSettingFromOpeningDeck(deck){const index=deck.indexOf("themeSetting");if(index<0)return false;deck.splice(index,1);return true;}
    function createOpeningSideFromShuffledDeck(deck,deckCounts){const copy=[...deck],has=extractThemeSettingFromOpeningDeck(copy);return{L:1,R:1,deckCounts,deck:copy.slice(3),hand:copy.slice(0,3).concat(has?["themeSetting"]:[]),discard:[]};}
    function moveThemeSettingToOpeningHand(player){if(extractThemeSettingFromOpeningDeck(state.decks[player])&&!state.hands[player].includes("themeSetting"))state.hands[player].push("themeSetting");}

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
      return stats.count === DECK_MAX_COUNT && stats.cost <= state.costLimit;
    }

    function areBothDecksValid() {
      return isDeckValid("human") && isDeckValid("cpu");
    }

    const DECK_STORAGE_KEY = "waribashiDecksV11";
    const DECK_SLOT_STORAGE_KEY = "waribashiDeckSlotsV55";
    const DECK_SLOT_COUNT = 6;

    function persistCurrentDecks(message = "") {
      const data = {
        version: 13,
        costLimit: state.costLimit,
        cpuDifficulty: state.cpuDifficulty,
        deckCounts: state.deckCounts
      };
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(data));
      if (message) setMessage(message);
    }

    function readDeckSlots() {
      const empty = { human: {}, cpu: {} };
      try {
        const raw = localStorage.getItem(DECK_SLOT_STORAGE_KEY);
        if (!raw) return empty;
        const data = JSON.parse(raw);
        for (const owner of ["human", "cpu"]) {
          for (let i = 1; i <= DECK_SLOT_COUNT; i++) {
            const slot = data?.[owner]?.[String(i)];
            if (!slot?.counts) continue;
            empty[owner][String(i)] = {
              name: String(slot.name || `スロット${i}`).slice(0, 24),
              counts: cloneValidDeckCounts(slot.counts)
            };
          }
        }
      } catch (error) {
        console.warn("デッキスロット読込失敗", error);
      }
      return empty;
    }

    function writeDeckSlots(slots) {
      localStorage.setItem(DECK_SLOT_STORAGE_KEY, JSON.stringify(slots));
    }

    function ensureStarterDeckInHumanSlotOne() {
      const slots = readDeckSlots();
      if (slots?.human?.["1"]) return false;
      slots.human["1"] = {
        name: "スターターデッキ",
        counts: cloneValidDeckCounts(DEFAULT_DECK_COUNTS)
      };
      writeDeckSlots(slots);
      return true;
    }

    function refreshDeckSlotOptionLabels() {
      if (!elements.deckSlotSelect) return;
      const owner = state.editingDeckOwner;
      const slots = readDeckSlots();
      for (const option of elements.deckSlotSelect.options) {
        const slotId = String(option.value);
        const slot = slots?.[owner]?.[slotId];
        option.textContent = slot?.name
          ? `スロット${slotId}｜${slot.name}`
          : `スロット${slotId}｜空き`;
      }
    }

    function updateDeckSlotUi() {
      if (!elements.deckSlotSelect) return;
      refreshDeckSlotOptionLabels();
      const owner = state.editingDeckOwner;
      const slotId = String(elements.deckSlotSelect.value || "1");
      const slots = readDeckSlots();
      const slot = slots?.[owner]?.[slotId];
      elements.deckSlotNameInput.value = slot?.name || "";
      elements.deckSlotStatus.textContent = slot
        ? `${owner === "human" ? "あなた用" : "CPU用"}・スロット${slotId}「${slot.name}」を保存済み。`
        : `${owner === "human" ? "あなた用" : "CPU用"}・スロット${slotId}は空です。`;
    }

    function saveDecks() {
      const owner = state.editingDeckOwner;
      const slotId = String(elements.deckSlotSelect?.value || "1");
      const slots = readDeckSlots();
      const name = String(elements.deckSlotNameInput?.value || "").trim().slice(0, 24) || `スロット${slotId}`;
      slots[owner][slotId] = {
        name,
        counts: cloneValidDeckCounts(currentDeckCounts(owner))
      };
      writeDeckSlots(slots);
      persistCurrentDecks();
      updateDeckSlotUi();
      setMessage(`${owner === "human" ? "あなた用" : "CPU用"}デッキをスロット${slotId}「${name}」に保存しました。`);
    }

    function loadDecks() {
      const owner = state.editingDeckOwner;
      const slotId = String(elements.deckSlotSelect?.value || "1");
      const slots = readDeckSlots();
      const slot = slots?.[owner]?.[slotId];
      if (!slot) {
        setMessage(`スロット${slotId}には保存済みデッキがありません。`);
        return;
      }
      state.deckCounts[owner] = cloneValidDeckCounts(slot.counts);
      persistCurrentDecks();
      renderDeckBuilder();
      setMessage(`${owner === "human" ? "あなた用" : "CPU用"}へ「${slot.name}」を読み込みました。`);
    }

    function loadDecksSilentlyOnStartup() {
      const raw = localStorage.getItem(DECK_STORAGE_KEY);
      if (!raw) return false;
      try {
        const data = JSON.parse(raw);
        if (data.deckCounts?.human && data.deckCounts?.cpu) {
          state.deckCounts = {
            human: { ...DEFAULT_DECK_COUNTS, ...cloneValidDeckCounts(data.deckCounts.human) },
            cpu: { ...DEFAULT_DECK_COUNTS, ...cloneValidDeckCounts(data.deckCounts.cpu) }
          };
        }
        if (Number.isFinite(Number(data.costLimit))) state.costLimit = Math.min(40, Number(data.costLimit));
        if (["easy", "standard", "hard"].includes(data.cpuDifficulty)) state.cpuDifficulty = data.cpuDifficulty;
        return true;
      } catch (error) {
        console.warn("保存済みデッキの自動読込に失敗しました。", error);
        return false;
      }
    }

    const DECK_CODE_PREFIX_V1 = "WBDECK1:";
    const DECK_CODE_PREFIX = "WBDECK2:";


    function cloneValidDeckCounts(counts) {
      const fixed = {};
      for (const cardId of Object.keys(CARD_LIBRARY)) {
        if (CARD_LIBRARY[cardId].token) continue;
        const raw = counts && Object.prototype.hasOwnProperty.call(counts, cardId) ? Number(counts[cardId]) : 0;
        const maxCopies=CARD_LIBRARY[cardId]?.maxDeckCopies||3;
        const value = Number.isFinite(raw) ? Math.max(0, Math.min(maxCopies, Math.floor(raw))) : 0;
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
      if (stats.count !== DECK_MAX_COUNT) {
        return { ok: false, reason: `デッキはちょうど${DECK_MAX_COUNT}枚にしてください。現在${stats.count}枚です。`, counts: fixed, stats };
      }
      if (stats.cost > state.costLimit) {
        return { ok: false, reason: `合計コストが上限を超えています。${stats.cost} / ${state.costLimit}`, counts: fixed, stats };
      }
      return { ok: true, counts: fixed, stats };
    }

    function compactDeckCounts(counts) {
      return Object.entries(cloneValidDeckCounts(counts))
        .filter(([, qty]) => qty > 0)
        .map(([cardId, qty]) => [cardId, qty]);
    }

    function expandCompactDeck(entries) {
      if (!Array.isArray(entries)) throw new Error("deck_shape");
      const counts = {};
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) throw new Error("deck_shape");
        const cardId = String(entry[0] || "");
        const qty = Number(entry[1]);
        if (!CARD_LIBRARY[cardId] || CARD_LIBRARY[cardId].token) throw new Error(`unknown_card:${cardId}`);
        if (!Number.isInteger(qty) || qty < 1 || qty > 3) throw new Error(`bad_qty:${cardId}`);
        counts[cardId] = qty;
      }
      return cloneValidDeckCounts(counts);
    }

    function utf8ToBase64Url(text) {
      const bytes = new TextEncoder().encode(text);
      let binary = "";
      bytes.forEach(byte => { binary += String.fromCharCode(byte); });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function base64UrlToUtf8(value) {
      const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    function normalizeDeckCodeInput(code) {
      let text = String(code || "").trim();
      text = text.replace(/^[`'\"]+|[`'\"]+$/g, "").trim();
      try {
        if (/%[0-9A-Fa-f]{2}/.test(text)) text = decodeURIComponent(text);
      } catch (_) {}
      return text.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "");
    }

    function encodeDeckPayload(payload) {
      return DECK_CODE_PREFIX + utf8ToBase64Url(JSON.stringify(payload));
    }

    function decodeDeckPayload(code) {
      const trimmed = normalizeDeckCodeInput(code);
      const upperPrefixView = trimmed.slice(0, Math.max(DECK_CODE_PREFIX.length, DECK_CODE_PREFIX_V1.length)).toUpperCase();
      if (upperPrefixView.startsWith(DECK_CODE_PREFIX)) {
        const json = base64UrlToUtf8(trimmed.slice(DECK_CODE_PREFIX.length));
        const payload = JSON.parse(json);
        if (!payload || payload.version !== 2) throw new Error("version");
        if (payload.kind === "single") payload.deck = expandCompactDeck(payload.deck);
        if (payload.kind === "both") {
          payload.decks = {
            human: expandCompactDeck(payload.decks?.human),
            cpu: expandCompactDeck(payload.decks?.cpu)
          };
        }
        return payload;
      }
      if (upperPrefixView.startsWith(DECK_CODE_PREFIX_V1)) {
        const base64 = trimmed.slice(DECK_CODE_PREFIX_V1.length);
        const json = decodeURIComponent(escape(atob(base64)));
        const payload = JSON.parse(json);
        if (!payload || payload.version !== 1) throw new Error("version");
        return payload;
      }
      throw new Error("prefix");
    }

    function makeCurrentDeckCode() {
      const owner = state.editingDeckOwner;
      return encodeDeckPayload({
        version: 2,
        kind: "single",
        owner,
        costLimit: state.costLimit,
        deck: compactDeckCounts(currentDeckCounts(owner))
      });
    }

    function makeBothDecksCode() {
      return encodeDeckPayload({
        version: 2,
        kind: "both",
        costLimit: state.costLimit,
        decks: {
          human: compactDeckCounts(state.deckCounts.human),
          cpu: compactDeckCounts(state.deckCounts.cpu)
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
          persistCurrentDecks();
          renderDeckBuilder();
          setMessage("デッキコードを読み込みました。現在の編集内容に反映済みです。");
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

          persistCurrentDecks();
          renderDeckBuilder();
          setMessage("まとめデッキコードを読み込みました。現在の編集内容に反映済みです。");
          return;
        }

        throw new Error("kind");
      } catch (error) {
        const message = String(error?.message || error || "");
        let reason = "コードが壊れているか、対応していない形式です。";
        if (message === "prefix") reason = "先頭の形式が違います。WBDECK1 または WBDECK2 のコードを貼り付けてください。";
        else if (message === "version") reason = "このデッキコードのバージョンには対応していません。";
        else if (message.startsWith("unknown_card:")) reason = `未知のカードID「${message.split(":")[1]}」が含まれています。`;
        else if (message.startsWith("bad_qty:")) reason = `カード枚数が不正です：「${message.split(":")[1]}」。`;
        else if (message === "deck_shape") reason = "デッキ内容の形式が壊れています。";
        setMessage(`デッキコード読込失敗：${reason}`);
      }
    }

    const DECK_INFO = {
      resonance: {
        kicker: "KEYWORD",
        title: "共鳴とは？",
        html: `<p><strong>共鳴</strong>は、攻撃開始時の「攻撃する手」と「攻撃対象の手」の本数が同じときに発生します。</p>
          <div class="deck-info-example">例：自分の3本の手 → 相手の3本の手 = 共鳴</div>
          <p>攻撃対象が自分の手でも判定されます。「凶弾」で自分のもう片方の手を攻撃した場合も、本数条件を満たせば共鳴します。</p>
          <p>「共鳴調節」が付いている攻撃手は、本数差が<strong>1以下</strong>でも共鳴します。</p>
          <p>受け流し・注目などで攻撃対象が変わった場合は、<strong>変更後の対象</strong>との本数で判定します。</p>
          <p>「乱舞」は通常攻撃ではない置換攻撃のため、共鳴判定を行いません。</p>`
      }
    };

    let deckInfoReturnToCurrentDeck = false;
    function openDeckInfo(infoKey, returnToCurrentDeck = false) {
      const preset = DECK_INFO[infoKey];
      const card = CARD_LIBRARY[infoKey];
      if (!preset && !card) return;
      deckInfoReturnToCurrentDeck = returnToCurrentDeck;
      elements.deckInfoKicker.textContent = preset?.kicker || (card?.token ? "GENERATED CARD" : "CARD INFO");
      elements.deckInfoTitle.textContent = preset?.title || card.name;
      elements.deckInfoBody.innerHTML = preset?.html || `
        <div class="deck-info-card-meta">
          <span class="card-type${card.trap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
          <span class="card-cost">コスト ${card.cost}</span>
        </div>
        <p>${escapeHtml(card.text)}</p>
        ${card.token ? '<div class="generated-card-note">生成カード / デッキ投入不可</div>' : ''}`;
      elements.deckInfoModal.classList.add("show");
      elements.deckInfoModal.setAttribute("aria-hidden", "false");
    }

    function closeDeckInfo() {
      if (deckInfoReturnToCurrentDeck) {
        deckInfoReturnToCurrentDeck = false;
        openCurrentDeckDetails();
        return;
      }
      elements.deckInfoModal.classList.remove("show");
      elements.deckInfoModal.setAttribute("aria-hidden", "true");
    }

    function normalizeDeckSearchText(value) {
      return String(value || "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, " ").trim();
    }

    function deckCardSearchText(cardId, card) {
      return normalizeDeckSearchText([
        cardId, card.name, card.type, card.text,
        ...(Array.isArray(card.searchKeywords) ? card.searchKeywords : []),
        ...deckCardThemes(cardId, card),
        card.trap ? "罠" : "", card.blessing ? "加護" : "",
        card.curse ? "呪縛" : "", card.chargeCard ? "充電" : "",
        card.directive ? "指令" : "", card.token ? "生成カード" : "",
        card.magicalTransformed ? "変身後 デッキ投入不可" : ""
      ].join(" "));
    }

    function deckCardThemes(cardId, card) {
      const themes = [];
      const add = value => { if (value && !themes.includes(value)) themes.push(value); };
      (Array.isArray(card.themes) ? card.themes : card.theme ? [card.theme] : []).forEach(add);
      if (card.chargeCard) add("充電");
      if (card.harpoonTheme) add("黄針");
      if (card.directive) add("指令");
      if (card.magical || card.magicalEvolution || card.magicalTransformed) add("魔法少女");
      const source = `${card.type || ""} ${card.text || ""}`;
      ["共鳴", "銃", "弾", "演舞", "均衡", "輪舞曲"].forEach(theme => { if (source.includes(theme)) add(theme); });
      return themes;
    }

    function deckCardFilterType(card) { return deckDetailGroupLabel(card); }

    function filterCardForDeckEditor(cardId, card, counts, filters = state.deckFilters) {
      const query = normalizeDeckSearchText(state.deckSearch || [state.deckNameSearch, state.deckKeywordSearch].filter(Boolean).join(" "));
      const count = counts[cardId] || 0;
      if (query && !deckCardSearchText(cardId, card).includes(query)) return false;
      if (filters.type && deckCardFilterType(card) !== filters.type) return false;
      if (filters.cost && (filters.cost === "4+" ? Number(card.cost) < 4 : Number(card.cost) !== Number(filters.cost))) return false;
      if (filters.theme && !deckCardThemes(cardId, card).includes(filters.theme)) return false;
      if (filters.deckOnly && count < 1) return false;
      if (filters.unselectedOnly && count > 0) return false;
      if (filters.favoriteOnly && !deckFavorites.has(cardId)) return false;
      return true;
    }

    function deckCardTypeSortKey(card) {
      const primary =
        card.token ? 90 : card.trap ? 10 : card.blessing ? 20 :
        card.curse ? 30 : card.directive ? 40 : card.chargeCard ? 50 : 60;
      return `${String(primary).padStart(2, "0")}:${normalizeDeckSearchText(card.type)}:${normalizeDeckSearchText(card.name)}`;
    }

    function getVisibleDeckCardIds() {
      const implementationIds = Object.keys(CARD_LIBRARY);
      const implementationIndex = new Map(implementationIds.map((id, index) => [id, index]));
      const counts = currentDeckCounts(state.editingDeckOwner);

      const visible = implementationIds.filter(cardId => {
        const card = CARD_LIBRARY[cardId];
        return filterCardForDeckEditor(cardId, card, counts);
      });

      visible.sort((a, b) => {
        const cardA = CARD_LIBRARY[a];
        const cardB = CARD_LIBRARY[b];
        const tokenDiff = Number(Boolean(cardA.token)) - Number(Boolean(cardB.token));
        if (tokenDiff) return tokenDiff;
        if (state.deckSortMode === "favorite") {
          const favoriteDiff = Number(deckFavorites.has(b)) - Number(deckFavorites.has(a));
          if (favoriteDiff) return favoriteDiff;
        }
        if (state.deckSortMode === "name") return cardA.name.localeCompare(cardB.name, "ja");
        if (state.deckSortMode === "cost") return cardA.cost - cardB.cost || cardA.name.localeCompare(cardB.name, "ja");
        if (state.deckSortMode === "type") return deckCardTypeSortKey(cardA).localeCompare(deckCardTypeSortKey(cardB), "ja");
        return implementationIndex.get(a) - implementationIndex.get(b);
      });
      return visible;
    }

    function canAddDeckCard(owner, cardId) {
      const card = CARD_LIBRARY[cardId], counts = currentDeckCounts(owner), current = counts[cardId] || 0;
      if (!card || card.token || card.magicalTransformed) return false;
      if (state.deckRuleContext?.ruleId && getDeckRestrictionReason(state.deckRuleContext.ruleId, cardId)) return false;
      const stats = getDeckStats(owner);
      return current < (card.maxDeckCopies || 3) && stats.count < DECK_MAX_COUNT && stats.cost + Number(card.cost || 0) <= state.costLimit;
    }

    function changeDeckCardCount(owner, cardId, delta) {
      const counts = currentDeckCounts(owner), current = counts[cardId] || 0;
      if (delta > 0 && !canAddDeckCard(owner, cardId)) return false;
      counts[cardId] = Math.max(0, current + (delta > 0 ? 1 : -1));
      persistCurrentDecks();
      return true;
    }

    function initializeDeckFilterOptions() {
      const types = [...new Set(Object.values(CARD_LIBRARY).map(deckCardFilterType))].sort((a,b) => a.localeCompare(b,"ja"));
      const themes = [...new Set(Object.entries(CARD_LIBRARY).flatMap(([id, card]) => deckCardThemes(id, card)))].sort((a,b) => a.localeCompare(b,"ja"));
      const fill = (select, values) => {
        if (!select || select.options.length > 1) return;
        values.forEach(value => select.add(new Option(value, value)));
      };
      fill(elements.deckTypeFilter, types);
      fill(elements.deckThemeFilter, themes);
    }

    function deckDetailGroupLabel(card) {
      if (card.trap) return "罠";
      if (card.blessing) return "加護";
      if (card.curse) return "呪縛";
      if (card.directive) return "指令";
      if (card.chargeCard) return "充電";
      if (String(card.type || "").includes("攻撃")) return "攻撃";
      if (String(card.type || "").includes("状態")) return "状態";
      if (String(card.type || "").includes("制限")) return "制限";
      return "その他";
    }

    function openCurrentDeckDetails() {
      deckInfoReturnToCurrentDeck = false;
      const owner = state.editingDeckOwner;
      const counts = currentDeckCounts(owner);
      const entries = Object.keys(CARD_LIBRARY)
        .filter(cardId => !CARD_LIBRARY[cardId].token && (counts[cardId] || 0) > 0)
        .map(cardId => ({ cardId, card: CARD_LIBRARY[cardId], count: counts[cardId] || 0 }));

      const groups = new Map();
      for (const entry of entries) {
        const label = deckDetailGroupLabel(entry.card);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(entry);
      }

      const groupOrder = ["攻撃", "罠", "加護", "呪縛", "充電", "指令", "状態", "制限", "その他"];
      const stats = getDeckStats(owner);
      const sectionHtml = groupOrder.filter(label => groups.has(label)).map(label => {
        const groupEntries = groups.get(label).sort((a, b) => a.card.name.localeCompare(b.card.name, "ja"));
        const groupCount = groupEntries.reduce((sum, entry) => sum + entry.count, 0);
        return `
          <section class="deck-detail-group">
            <div class="deck-detail-group-head"><strong>${escapeHtml(label)}</strong><span>${groupCount}枚 / ${groupEntries.length}種類</span></div>
            <div class="deck-detail-card-list">
              ${groupEntries.map(entry => `
                <div class="deck-detail-card-row" data-card="${entry.cardId}">
                  <div>
                    <button class="deck-detail-card-name deck-detail-info" data-info="${entry.cardId}">${escapeHtml(entry.card.name)}</button>
                    <div class="deck-detail-card-meta">${escapeHtml(entry.card.type)} / コスト${entry.card.cost}</div>
                  </div>
                  <div class="count-control deck-detail-count-control">
                    <button class="secondary" data-detail-action="minus" data-card="${entry.cardId}">−</button>
                    <strong class="deck-detail-card-count">×${entry.count}</strong>
                    <button data-detail-action="plus" data-card="${entry.cardId}" ${canAddDeckCard(owner, entry.cardId) ? "" : "disabled"}>＋</button>
                  </div>
                </div>`).join("")}
            </div>
          </section>`;
      }).join("");

      elements.deckInfoKicker.textContent = "CURRENT DECK";
      elements.deckInfoTitle.textContent = `${owner === "human" ? "あなた用" : "CPU用"}デッキ詳細`;
      elements.deckInfoBody.innerHTML = `
        <div class="deck-detail-summary">
          <span>現在 ${stats.count} / ${DECK_MAX_COUNT}枚</span><span>残り ${Math.max(0, DECK_MAX_COUNT - stats.count)}枚</span>
          <span>コスト ${stats.cost} / ${state.costLimit}</span><span>残りコスト ${Math.max(0, state.costLimit - stats.cost)}</span><span>${entries.length}種類</span>
        </div>
        ${sectionHtml || '<div class="deck-detail-empty">デッキにカードが入っていません。</div>'}`;
      elements.deckInfoModal.classList.add("show");
      elements.deckInfoModal.setAttribute("aria-hidden", "false");
      elements.deckInfoBody.querySelectorAll("[data-detail-action]").forEach(button => button.addEventListener("click", () => {
        const delta = button.dataset.detailAction === "plus" ? 1 : -1;
        if (changeDeckCardCount(owner, button.dataset.card, delta)) {
          renderDeckBuilder();
          openCurrentDeckDetails();
        }
      }));
      elements.deckInfoBody.querySelectorAll(".deck-detail-info").forEach(button => button.addEventListener("click", () => openDeckInfo(button.dataset.info, true)));
    }

    function renderDeckBuilder() {
      const owner = state.editingDeckOwner;
      const counts = currentDeckCounts(owner);
      const ruleId=state.deckRuleContext?.ruleId||null,ruleDef=ruleId?REGULATION_DEFS[ruleId]:null,contextLabel=document.getElementById("deckRuleContextLabel");
      if(contextLabel){contextLabel.hidden=!ruleDef;contextLabel.textContent=ruleDef?`${ruleDef.name}用デッキ編集中`:"";}
      elements.deckGrid.innerHTML = "";
      const visibleCardIds = getVisibleDeckCardIds();
      visibleCardIds.forEach(cardId => {
        const card = CARD_LIBRARY[cardId];
        const count = counts[cardId] || 0;
        const row = document.createElement("div");
        const restrictionReason=ruleId?getDeckRestrictionReason(ruleId,cardId):"";
        row.className = "deck-row" + (displaySettings.deckCompactMode ? " deck-row-compact" : "") + (card.blessing ? " blessing-card" : card.curse ? " curse-card" : "") + (card.token ? " generated-card" : "") + (card.magicalEvolution ? " magical-evolution-card" : "");
        if(restrictionReason)row.classList.add("rule-blocked");
        const relatedButtons = [];
        if (cardId === "focusedShot") relatedButtons.push('<button class="deck-inline-info" data-info="logicCrusherBullet">生成カード「ロジックアトリエ」を確認</button>');
        if (cardId === "lastMelody") relatedButtons.push('<button class="deck-inline-info" data-info="finale">生成カード「フィナーレ」を確認</button>');
        if (MAGICAL_EVOLUTION_MAP[cardId]) {
          const transformedId = MAGICAL_EVOLUTION_MAP[cardId];
          relatedButtons.push(`<button class="deck-inline-info" data-info="${transformedId}">変身後「${escapeHtml(CARD_LIBRARY[transformedId].name)}」を確認</button>`);
        }
        if (PERFORMANCE_LV5_EVOLUTION_MAP[cardId]) {
          const transformedId = PERFORMANCE_LV5_EVOLUTION_MAP[cardId];
          relatedButtons.push(`<button class="deck-inline-info" data-info="${transformedId}">演舞Ⅴ以上「${escapeHtml(CARD_LIBRARY[transformedId].name)}」を確認</button>`);
        }
        if (["allegro", "resonanceTuning", "crescendo", "dance", "largo", "andante", "lastMelody"].includes(cardId)) relatedButtons.push('<button class="deck-inline-info" data-info="resonance">共鳴とは？</button>');
        if (card.harpoonTheme && cardId !== "harpoon") relatedButtons.push('<button class="deck-inline-info" data-info="harpoon">銛とは？</button>');
        const relatedButton = relatedButtons.join("");
        row.innerHTML = `
          <div>
            <div class="card-title">
              <button class="deck-favorite-btn" data-favorite="${cardId}" aria-pressed="${deckFavorites.has(cardId)}" aria-label="${escapeHtml(card.name)}をお気に入り${deckFavorites.has(cardId) ? "解除" : "登録"}">${deckFavorites.has(cardId) ? "★" : "☆"}</button>
              <button class="deck-card-name deck-card-info" data-info="${cardId}">${escapeHtml(card.name)}</button>
            </div>
            <div class="card-label-row">
              <span class="card-type${card.trap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
              ${card.token ? '<span class="generated-badge">生成カード</span>' : ''}
            </div>
            <div class="card-cost">コスト ${card.cost}</div>
            <div class="deck-card-desc">${card.directive ? directiveCardTextHtml(cardId, card) : escapeHtml(card.text)}</div>
            <div class="deck-inline-actions">${relatedButton}${card.token ? `<button class="deck-inline-info" data-info="${cardId}">詳細を見る</button>` : ""}</div>
          </div>
          ${restrictionReason?`<div class="deck-rule-lock">🔒 ${escapeHtml(restrictionReason)}</div>`:""}
          ${card.token ? '<div class="generated-lock">デッキ投入不可</div>' : `<div class="count-control">
            <button class="secondary" data-action="minus" data-card="${cardId}">−</button>
            <span class="count-num">${count}</span>
            <button data-action="plus" data-card="${cardId}" ${canAddDeckCard(owner, cardId) ? "" : "disabled"}>＋</button>
          </div>`}
        `;
        elements.deckGrid.appendChild(row);
      });

      elements.deckGrid.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", (event) => {
          const infoKey = btn.dataset.info;
          if (infoKey) {
            event.preventDefault();
            event.stopPropagation();
            openDeckInfo(infoKey);
            return;
          }
          const favoriteId = btn.dataset.favorite;
          if (favoriteId) {
            deckFavorites.has(favoriteId) ? deckFavorites.delete(favoriteId) : deckFavorites.add(favoriteId);
            saveDeckFavorites();
            renderDeckBuilder();
            return;
          }

          const cardId = btn.dataset.card;
          const action = btn.dataset.action;
          if (!cardId || !action) return;

          const clickedRestrictionReason=ruleId?getDeckRestrictionReason(ruleId,cardId):"";
          if(action === "plus" && clickedRestrictionReason){setMessage(clickedRestrictionReason);return;}
          if (!changeDeckCardCount(owner, cardId, action === "plus" ? 1 : -1)) return;
          renderDeckBuilder();
        });
      });

      updateDeckSlotUi();

      const stats = getDeckStats(owner);
      const valid = isDeckValid(owner);
      const other = owner === "human" ? "cpu" : "human";
      const otherStats = getDeckStats(other);
      elements.deckOwnerSelect.value = owner;
      elements.cpuDifficultySelect.value = state.cpuDifficulty;
      if (elements.deckSortSelect) elements.deckSortSelect.value = state.deckSortMode;
      elements.deckGrid.classList.toggle("compact", displaySettings.deckCompactMode);
      if (elements.deckSearchInput && elements.deckSearchInput.value !== state.deckSearch) elements.deckSearchInput.value = state.deckSearch;
      if (elements.deckTypeFilter) elements.deckTypeFilter.value = state.deckFilters.type;
      if (elements.deckCostFilter) elements.deckCostFilter.value = state.deckFilters.cost;
      if (elements.deckThemeFilter) elements.deckThemeFilter.value = state.deckFilters.theme;
      if (elements.deckOnlyToggle) elements.deckOnlyToggle.checked = state.deckFilters.deckOnly;
      if (elements.deckUnselectedToggle) elements.deckUnselectedToggle.checked = state.deckFilters.unselectedOnly;
      if (elements.deckFavoriteOnlyToggle) elements.deckFavoriteOnlyToggle.checked = state.deckFilters.favoriteOnly;
      if (elements.deckSearchResultText) {
        const total = Object.keys(CARD_LIBRARY).length;
        const hasSearch = !!(state.deckSearch || Object.values(state.deckFilters).some(Boolean));
        elements.deckSearchResultText.textContent = hasSearch ? `${visibleCardIds.length}件 / 全${total}件` : `全${total}件を表示中`;
      }
      const validText = valid ? "使用可能" : stats.count !== DECK_MAX_COUNT ? `ちょうど${DECK_MAX_COUNT}枚必要` : "コスト超過";
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


    const DIRECTIVE_BASE_IDS = ["directiveAttack", "directiveTarget", "directiveSilence", "directiveReform", "directiveAnnihilation", "directiveCombo", "directiveConstant"];

    function resetDirectiveMatchState() {
      state.pendingDirectiveDraw={human:0,cpu:0};state.pendingDirectiveNoDraw={human:0,cpu:0};state.pendingDirectiveBonusDraw={human:0,cpu:0};state.lastDirectiveClearCount={human:0,cpu:0};state.activeDirectiveBlessing={human:0,cpu:0};
      state.directiveTotalClears={human:0,cpu:0};state.naturalFaithUses={human:0,cpu:0};state.divineProofUsed={human:false,cpu:false};state.pendingDeusVult={human:false,cpu:false};
      state.pendingDirectiveHandAttackModifier={human:{L:0,R:0},cpu:{L:0,R:0}};state.pendingDirectiveNextAttackModifier={human:0,cpu:0};state.pendingDirectiveReformContinue={human:false,cpu:false};state.activeDirectiveReformContinue={human:false,cpu:false};state.pendingDirectiveNoSplit={human:false,cpu:false};state.pendingDirectiveAnnihilation={human:false,cpu:false};state.activeDirectiveAnnihilation={human:false,cpu:false};state.pendingDirectiveAttackLimitDelta={human:0,cpu:0};
    }

    function isDirectiveCard(cardId) {
      return !!CARD_LIBRARY[cardId]?.directive;
    }

    function directiveBaseId(cardId) {
      const card = CARD_LIBRARY[cardId];
      return card?.directiveBase || cardId;
    }

    function directiveHandLabel(hand) {
      return hand === "R" ? "右" : hand === "L" ? "左" : "未指定";
    }

    function makeDirectiveVariant(baseId, reinterpreted = false) {
      if (baseId === "directiveAttack") {
        const hand = Math.random() < 0.5 ? "L" : "R";
        const id = `directiveAttack_${hand}${reinterpreted ? "_re" : ""}`;
        if (!CARD_LIBRARY[id]) {
          CARD_LIBRARY[id] = {
            ...CARD_LIBRARY.directiveAttack,
            cost: 1,
            name: `指令：指定攻撃［${directiveHandLabel(hand)}］`,
            text: `指定：${directiveHandLabel(hand)}手で攻撃。達成：その手の次の通常攻撃+1。未達成：その手の次の通常攻撃-1。`,
            directive: true,
            directiveBase: "directiveAttack",
            directiveData: { attackHand: hand, reinterpreted },
            token: true
          };
        }
        return id;
      }
      if (baseId === "directiveTarget") {
        const attackHand = Math.random() < 0.5 ? "L" : "R";
        const targetHand = Math.random() < 0.5 ? "L" : "R";
        const id = `directiveTarget_${attackHand}_${targetHand}${reinterpreted ? "_re" : ""}`;
        if (!CARD_LIBRARY[id]) {
          CARD_LIBRARY[id] = {
            ...CARD_LIBRARY.directiveTarget,
            cost: 1,
            name: `指令：対象指定［${directiveHandLabel(attackHand)}→${directiveHandLabel(targetHand)}］`,
            text: `指定：${directiveHandLabel(attackHand)}手 → ${directiveHandLabel(targetHand)}手を攻撃。達成：1枚引く。未達成：指定された自分の手に1本加える。`,
            directive: true,
            directiveBase: "directiveTarget",
            directiveData: { attackHand, targetHand, reinterpreted },
            token: true
          };
        }
        return id;
      }
      if (baseId === "directiveConstant") {
        const value = 1 + Math.floor(Math.random() * 4);
        const id = `directiveConstant_${value}${reinterpreted ? "_re" : ""}`;
        if (!CARD_LIBRARY[id]) CARD_LIBRARY[id] = { ...CARD_LIBRARY.directiveConstant, cost:1, name:`指令：定数［${value}］`, text:`指定：${value}。相手のどちらかの手が${value}なら達成：2枚引く。未達成：相手の生存手を${value}へ1近づける。`, directive:true,directiveBase:"directiveConstant",directiveData:{value,reinterpreted},token:true };
        return id;
      }
      return baseId;
    }

    function materializeDrawnCard(cardId) {
      const base = directiveBaseId(cardId);
      if (DIRECTIVE_BASE_IDS.includes(cardId)) return makeDirectiveVariant(cardId);
      if (base === "directiveAttack") {
        const data = CARD_LIBRARY[cardId]?.directiveData;
        if (!data || !["L", "R"].includes(data.attackHand)) return makeDirectiveVariant(base);
      }
      if (base === "directiveTarget") {
        const data = CARD_LIBRARY[cardId]?.directiveData;
        if (!data || !["L", "R"].includes(data.attackHand) || !["L", "R"].includes(data.targetHand)) {
          return makeDirectiveVariant(base);
        }
      }
      if (base === "directiveConstant") {
        const data=CARD_LIBRARY[cardId]?.directiveData;
        if(!data||![1,2,3,4].includes(Number(data.value)))return makeDirectiveVariant(base);
      }
      return cardId;
    }

    function normalizeDirectiveCardsInHand(player) {
      let changed = false;
      state.hands[player] = state.hands[player].map(cardId => {
        const normalized = materializeDrawnCard(cardId);
        if (normalized !== cardId) changed = true;
        return normalized;
      });
      return changed;
    }

    function ensureDirectiveVariantDefinitions() {
      for (const hand of ["L", "R"]) {
        const id = `directiveAttack_${hand}`;
        if (!CARD_LIBRARY[id]) {
          CARD_LIBRARY[id] = {
            ...CARD_LIBRARY.directiveAttack,
            cost: 1,
            name: `指令：指定攻撃［${directiveHandLabel(hand)}］`,
            text: `指定：${directiveHandLabel(hand)}手で通常攻撃。達成：その手の次の通常攻撃で加える本数+1。未達成：その手の次の通常攻撃で加える本数-1。`,
            directive: true,
            directiveBase: "directiveAttack",
            directiveData: { attackHand: hand },
            token: true
          };
        }
      }
      for (const attackHand of ["L", "R"]) {
        for (const targetHand of ["L", "R"]) {
          const id = `directiveTarget_${attackHand}_${targetHand}`;
          if (!CARD_LIBRARY[id]) {
            CARD_LIBRARY[id] = {
              ...CARD_LIBRARY.directiveTarget,
              cost: 1,
              name: `指令：対象指定［${directiveHandLabel(attackHand)}→${directiveHandLabel(targetHand)}］`,
              text: `指定：${directiveHandLabel(attackHand)}手 → ${directiveHandLabel(targetHand)}手を通常攻撃。達成：1枚引く。未達成：指定された自分の手に1本加える。`,
              directive: true,
              directiveBase: "directiveTarget",
              directiveData: { attackHand, targetHand },
              token: true
            };
          }
        }
      }
    }

    ensureDirectiveVariantDefinitions();
    for(let lv=1;lv<=10;lv++) ensureChargeDefinition(lv);
    for (const card of Object.values(CARD_LIBRARY)) {
      if (card?.chargeCard && !card.chargeResource) {
        card.oncePerTurn = true;
        if (!card.text.includes("このカードは1ターンに1度")) {
          card.text += " このカードは1ターンに1度しか使用できない。";
        }
      }
    }

    function recordDirectiveAttack(player, attackHand, defender, targetHand) {
      if (!state.temp[player]?.directiveActions) return;
      state.temp[player].directiveActions.attacks.push({
        attackHand,
        targetHand,
        defender,
        selfAttack: defender === player
      });
    }

    function transferDirective(player, handIndex) {
      const cardId = state.hands[player][handIndex];
      if (!isDirectiveCard(cardId)) return false;
      const opponent = player === "human" ? "cpu" : "human";
      state.hands[player].splice(handIndex, 1);
      state.hands[opponent].push(materializeDrawnCard(cardId));
      addLog(`${handNames[player]}は「都市の意志」で「${CARD_LIBRARY[cardId].name}」を${handNames[opponent]}へ渡した。`);
      state.mode = "attack";
      render();
      return true;
    }

    function directiveWasCleared(player, cardId) {
      const card = CARD_LIBRARY[cardId];
      const data = card?.directiveData || {};
      const actions = state.temp[player]?.directiveActions || { attacks: [], splitUsed: false, cardUsed: false };
      const base = directiveBaseId(cardId);
      if (base === "directiveAttack") {
        return actions.attacks.some(a => a.attackHand === data.attackHand);
      }
      if (base === "directiveTarget") {
        return actions.attacks.some(a =>
          a.attackHand === data.attackHand &&
          a.targetHand === data.targetHand
        );
      }
      if (base === "directiveSilence") return !actions.cardUsed;
      if (base === "directiveReform") return !!actions.splitUsed;
      if (base === "directiveAnnihilation") return !!state.temp[player]?.opponentZeroedThisTurn;
      if (base === "directiveCombo") return Number(state.temp[player]?.attacksOccurredThisTurn||0) >= 2;
      if (base === "directiveConstant") {
        const value=Number(data.value); const opponent=otherPlayer(player);
        return state[opponent].L===value||state[opponent].R===value;
      }
      return false;
    }

    async function showDirectiveClearFx(count, player) {
      if (!count) return;
      const layer = elements.directiveClearFx;
      if (!layer) return;
      elements.directiveClearText.textContent = count > 1 ? `CLEAR ×${count}` : "CLEAR";
      layer.classList.add("show");
      await delay(1350);
      layer.classList.remove("show");
      await delay(80);
    }

    async function applyDirectiveFailure(player, cardId) {
      const base = directiveBaseId(cardId);
      const card = CARD_LIBRARY[cardId];
      if (base === "directiveAttack") {
        const hand=card.directiveData?.attackHand;if(hand)state.pendingDirectiveHandAttackModifier[player][hand]-=1;
      } else if (base === "directiveTarget") {
        const hand = card.directiveData?.attackHand;
        if (hand) await addFingersWithCalculation(player, hand, 1, "指令未達成");
      } else if (base === "directiveSilence") {
        state.pendingIntemperanceCardLock[player]=true;state.pendingCardUseLockSource[player]="directiveSilence";
      } else if (base === "directiveReform") {
        state.pendingDirectiveNoSplit[player]=true;
      } else if(base==="directiveAnnihilation"){
        state.pendingDirectiveNextAttackModifier[player]-=1;
      } else if(base==="directiveCombo"){
        state.pendingDirectiveAttackLimitDelta[player]-=1;
      } else if(base==="directiveConstant"){
        if(isRomanPreparation())return;
        const opponent=otherPlayer(player);const living=["L","R"].filter(h=>state[opponent][h]>0);
        if(living.length){const hand=living[Math.floor(Math.random()*living.length)];const value=Number(card.directiveData?.value)||1;state[opponent][hand]+=Math.sign(value-state[opponent][hand]);}
      }
    }

    async function resolveDirectives(player) {
      normalizeDirectiveCardsInHand(player);
      const directives = state.hands[player]
        .map((id, index) => ({ id, index }))
        .filter(x => isDirectiveCard(x.id));
      if (!directives.length) {
        state.lastDirectiveClearCount[player] = 0;
        state.activeDirectiveBlessing[player] = 0;
        return;
      }

      const cleared = [];
      const failed = [];
      for (const item of directives) {
        (state.temp[player]?.naturalFaithActive || directiveWasCleared(player, item.id) ? cleared : failed).push(item);
      }

      const removeIndexes = directives.map(x => x.index).sort((a, b) => b - a);
      for (const index of removeIndexes) {
        const [id] = state.hands[player].splice(index, 1);
        state.discard[player].push(id);
      }

      for (const item of cleared) {
        addLog(`【指令】「${CARD_LIBRARY[item.id].name}」達成。`);
        const base = directiveBaseId(item.id);
        if (base === "directiveAttack") {
          const hand=CARD_LIBRARY[item.id].directiveData?.attackHand;if(hand)state.pendingDirectiveHandAttackModifier[player][hand]+=1;
        }
        else if (base === "directiveTarget") {
          drawCard(player);
        } else if (base === "directiveSilence") {
          drawCard(player);
          drawCard(player);
          drawCard(player);
        } else if (base === "directiveReform") {
          state.pendingDirectiveReformContinue[player]=true;
        } else if(base==="directiveAnnihilation")state.pendingDirectiveAnnihilation[player]=true;
        else if(base==="directiveCombo")state.pendingDirectiveAttackLimitDelta[player]+=1;
        else if(base==="directiveConstant"){drawCard(player);drawCard(player);}
      }

      for (const item of failed) {
        addLog(`【指令】「${CARD_LIBRARY[item.id].name}」未達成。`);
        await applyDirectiveFailure(player, item.id);
      }

      state.lastDirectiveClearCount[player] = cleared.length;
      state.directiveTotalClears[player]=Number(state.directiveTotalClears[player]||0)+cleared.length;
      state.activeDirectiveBlessing[player] = cleared.length;
      if (hasAttachment(player, "L", "directiveBlessing") || hasAttachment(player, "R", "directiveBlessing")) {
        if (cleared.length > 0) {
          addLog(`${handNames[player]}の「指令の加護」に、次の相手ターン用の軽減${cleared.length}が記録された。`);
        } else {
          addLog(`${handNames[player]}の「指令の加護」は、達成した指令がないため軽減0。`);
        }
      }

      if (state.temp[player]?.ominousPower) {
        if (cleared.length >= 3) {
          state.pendingWillTorrent[player] = (state.pendingWillTorrent[player] || 0) + 1;
          addLog(`${handNames[player]}の「不吉な力」が成立。次の自分のターンに「意志の奔流」を得る。`);
        } else {
          addLog(`${handNames[player]}の「不吉な力」は不成立。達成した指令は${cleared.length}個だった。`);
        }
        state.temp[player].ominousPower = false;
      }

      if (cleared.length) {
        if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
          emitFriendFx("directiveClear", {
            playerSide: friendSideForLocalPlayer(player),
            count: cleared.length
          }).catch(error => console.error("PVP directive clear fx failed", error));
        }
        await showDirectiveClearFx(cleared.length, player);
      }
      if(state.temp[player])state.temp[player].naturalFaithActive=false;
    }

    function drawDirectiveFromDeck(player) {
      if (state.activeDrawLock?.[player]) return false;
      const candidates = state.decks[player]
        .map((id, index) => ({ id, index }))
        .filter(x => DIRECTIVE_BASE_IDS.includes(directiveBaseId(x.id)));
      if (!candidates.length) return false;
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      const [baseId] = state.decks[player].splice(picked.index, 1);
      state.hands[player].push(materializeDrawnCard(directiveBaseId(baseId)));
      return true;
    }

    async function showWillTorrentFx(player, count = 0) {
      const layer = elements.willTorrentFx;
      if (!layer) return;
      elements.willTorrentCount.textContent = count > 0 ? `指令 ×${count}` : "指令";
      layer.classList.add("show");
      await delay(1800);
      layer.classList.remove("show");
      await delay(160);
    }

    async function resolveWillTorrent(player) {
      const opponent = player === "human" ? "cpu" : "human";
      const deckDirectiveIndexes = state.decks[player]
        .map((id, index) => ({ id, index }))
        .filter(x => isDirectiveCard(x.id) || DIRECTIVE_BASE_IDS.includes(directiveBaseId(x.id)));

      const collected = [];
      for (const item of [...deckDirectiveIndexes].sort((a, b) => b.index - a.index)) {
        const [id] = state.decks[player].splice(item.index, 1);
        collected.push(materializeDrawnCard(directiveBaseId(id)));
      }
      state.hands[player].push(...collected);

      const transferred = [];
      const keep = [];
      for (const id of state.hands[player]) {
        if (isDirectiveCard(id)) transferred.push(id);
        else keep.push(id);
      }
      state.hands[player] = keep;
      state.hands[opponent].push(...transferred.map(materializeDrawnCard));
      normalizeDirectiveCardsInHand(opponent);

      addLog(`${handNames[player]}は「意志の奔流」を使用。山札から指令${collected.length}枚を集め、手札の指令${transferred.length}枚を${handNames[opponent]}へ渡した。`);

      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        emitFriendFx("willTorrent", {
          playerSide: friendSideForLocalPlayer(player),
          count: transferred.length
        }).catch(error => console.error("PVP will torrent fx failed", error));
      }

      await showWillTorrentFx(player, transferred.length);
      state.pendingTerminalEnd[player] = true;
      render();
    }

    function getReinterpretationCandidates(player){return state.hands[player].map((id,index)=>({id,index})).filter(x=>["directiveAttack","directiveTarget","directiveConstant"].includes(directiveBaseId(x.id))&&!CARD_LIBRARY[x.id]?.directiveData?.reinterpreted);}
    async function useReinterpretation(player){
      const candidates=getReinterpretationCandidates(player);if(!candidates.length)return false;
      let picked;
      if(player==="human"){
        const indexes=new Set(candidates.map(x=>x.index));
        const chosen=await beginHandCardSelection(player,{min:1,max:1,filter:(_id,index)=>indexes.has(index),message:"再解釈する指令を1枚選んでください。"});
        if(!chosen?.length)return false;picked=candidates.find(x=>x.index===chosen[0]);
      }else picked=candidates[Math.floor(Math.random()*candidates.length)];
      if(!picked)return false;
      const base=directiveBaseId(picked.id);const replacement=makeDirectiveVariant(base,true);
      state.hands[player][picked.index]=replacement;addLog(`${handNames[player]}は「${CARD_LIBRARY[picked.id].name}」を再解釈し、「${CARD_LIBRARY[replacement].name}」へ変更した。`);render();return true;
    }
    function useNaturalFaith(player){state.naturalFaithUses[player]=Number(state.naturalFaithUses[player]||0)+1;state.temp[player].naturalFaithActive=true;addLog(`${handNames[player]}は「当然の信心」により、このターンの指令をすべて達成として扱う。`);return true;}
    function markDirectiveOpponentZero(sourcePlayer,targetPlayer,before=1){if(targetPlayer===otherPlayer(sourcePlayer)&&before>0&&state.temp?.[sourcePlayer])state.temp[sourcePlayer].opponentZeroedThisTurn=true;}
    async function useDivineProof(player){
      if(state.divineProofUsed[player]||Number(state.directiveTotalClears[player]||0)<10)return false;
      state.divineProofUsed[player]=true;state.pendingDeusVult[player]=true;
      for(let i=state.hands[player].length-1;i>=0;i--)if(state.hands[player][i]==="divineProof")await discardHandCardByEffect(player,i);
      const removed=state.decks[player].filter(id=>id==="divineProof").length;state.decks[player]=state.decks[player].filter(id=>id!=="divineProof");
      for(let i=0;i<removed;i++)state.discard[player].push("divineProof");
      addLog(`${handNames[player]}は「神意の証明」を完了した。次の自分ターンに「DEUS VULT」を得る。`);return true;
    }
    function ensureDeusVultOverlay(){let el=document.getElementById("deusVultFx");if(!el){el=document.createElement("div");el.id="deusVultFx";el.className="deus-vult-fx";el.innerHTML='<div class="deus-vult-sub">神がそれを望まれる</div><div class="deus-vult-title">DEUS VULT</div><div class="deus-vult-line"></div>';document.body.appendChild(el);}return el;}
    function emitDeusVultPhase(phase,detail={}){document.dispatchEvent(new CustomEvent("deus-vult-phase",{detail:{phase,...detail}}));}
    async function beginDeusVultFx(){const el=ensureDeusVultOverlay();emitDeusVultPhase("start");el.classList.add("show");await delay(420);emitDeusVultPhase("title");await delay(480);}
    async function pulseDeusVultHit(target,index){const local=target.player||target.playerSide;const handEl=local==="human"?elements[`human${target.hand}`]:elements[`cpu${target.hand}`];emitDeusVultPhase("hit",{index,target:{player:local,hand:target.hand}});handEl?.classList.add("deus-vult-hit");await delay(180);handEl?.classList.remove("deus-vult-hit");}
    function deusVultHitInterval(hitCount){return hitCount<=5?650:hitCount<=10?575:475;}
    async function endDeusVultFx(){await delay(360);ensureDeusVultOverlay().classList.remove("show");emitDeusVultPhase("overlay-end");await delay(400);}
    async function showDeusVultFx(targets=[]){await beginDeusVultFx();await endDeusVultFx();const interval=deusVultHitInterval(targets.length);for(let i=0;i<targets.length;i++){await pulseDeusVultHit(targets[i],i);await delay(interval);}emitDeusVultPhase("end");}
    async function useDeusVult(player){
      const total=Number(state.directiveTotalClears[player]||0);const hits=Math.floor(total/2);const targets=[];
      await beginDeusVultFx();
      await endDeusVultFx();
      const interval=deusVultHitInterval(hits);
      for(let i=0;i<hits;i++){const candidates=[];for(const owner of [player,otherPlayer(player)])for(const hand of ["L","R"])if(state[owner][hand]>0)candidates.push({player:owner,hand});if(!candidates.length)break;const picked=candidates[Math.floor(Math.random()*candidates.length)];targets.push(picked);await pulseDeusVultHit(picked,i);await addFingersWithCalculation(picked.player,picked.hand,1,"DEUS VULT");await delay(interval);if(checkWin())break;}
      emitDeusVultPhase("end");
      if(state.battleMode==="friend"&&!state.friendApplyingRemoteState)await emitFriendFx("deusVult",{sourceSide:friendSideForLocalPlayer(player),totalClears:total,targets:targets.map(t=>({playerSide:friendSideForLocalPlayer(t.player),hand:t.hand}))}).catch(error=>console.error("PVP DEUS VULT fx failed",error));
      state.pendingTerminalEnd[player]=true;return true;
    }

    function chargeLevelFromId(cardId){ const m=/^charge_(\d+)$/.exec(cardId||""); return m?Math.max(1,Math.min(10,Number(m[1])||1)):(cardId==="charge"?1:0); }
    function ensureChargeDefinition(level){ const lv=Math.max(1,Math.min(10,Number(level)||1)); const id=`charge_${lv}`; if(!CARD_LIBRARY[id]) CARD_LIBRARY[id]={...CARD_LIBRARY.charge,name:`充電 Lv.${lv}`,cost:lv,text:`現在Lv.${lv}。コスト${lv}。充電効果以外では捨てたり移動できない。`,token:true,chargeResource:true,chargeLevel:lv}; return id; }
    function getChargeEntries(player){ return state.hands[player].map((cardId,index)=>({cardId,index,level:chargeLevelFromId(cardId)})).filter(x=>x.level>0); }
    function getChargeLevel(player){ const e=getChargeEntries(player); return e.length?Math.max(...e.map(x=>x.level)):0; }
    function countOwnAttachment(player, cardId) {
      return ["L", "R"].reduce(
        (sum, hand) => sum + state.traps[player][hand].filter(slot => trapCardId(slot) === cardId).length,
        0
      );
    }


    function isBalanced(player) {
      return state[player].L > 0 && state[player].R > 0 && state[player].L === state[player].R;
    }
    function allLivingHandsEqual() {
      const values=[];
      for(const p of ["human","cpu"]) for(const h of ["L","R"]) if(state[p][h]>0) values.push(state[p][h]);
      return values.length>0 && values.every(v=>v===values[0]);
    }
    function canUseFinalJudgment(player) {
      return Number(state.personalTurnCount?.[player]||0) >= 2 && allLivingHandsEqual();
    }
    async function resolveFinalJudgmentEffect(player, verdict) {
      if (!allLivingHandsEqual()) {
        addLog(`${handNames[player]}の「最終判決：${verdict}」は、すべての生存している手が均衡していないため不発。`);
        return false;
      }
      const opponent = otherPlayer(player);
      if (verdict === "没収") {
        await discardRandomCards(opponent, state.hands[opponent].length, "「最終判決：没収」");
      } else if (verdict === "死刑") {
        state.hands[player].push("execution", "execution");
        addLog(`${handNames[player]}は「執行」を2枚得た。`);
      } else if (verdict === "懲役") {
        state.judgmentPrisonTurns[opponent] = Math.max(3, Number(state.judgmentPrisonTurns[opponent] || 0));
        addLog(`${handNames[opponent]}は「懲役」により次の3回のターン、カードを使用できない。`);
      }
      state.pendingTerminalEnd[player] = true;
      return true;
    }
    function beginTuning(player) {
      const choices = ["L", "R"].filter(hand => state[player][hand] > 0);
      if (!choices.length) {
        addLog(`${handNames[player]}の「調律」は対象が存在しないため不発。`);
        return false;
      }
      if(player==="human") { state.mode="tuningTarget"; setMessage("「調律」：もう片方と同じ本数にする自分の0ではない手を選んでください。"); return true; }
      const hand = choices.sort((a, b) => state[player][b] - state[player][a])[0];
      const before = state[player][hand];
      state[player][hand] = state[player][otherHand(hand)];
      clearBrokenTraps(player);
      addLog(`${handNames[player]}は「調律」で${handNames[hand]}を${before}→${state[player][hand]}にそろえた。`);
      return true;
    }
    async function beginFairWorld(player) {
      if(player==="human") { state.mode="fairWorldTarget"; setMessage("「平等な世界」：基準にする自分の0ではない手を選んでください。"); return; }
      const h=state.cpu.L>=state.cpu.R?"L":"R"; await resolveFairWorld("cpu",h);
    }
    async function resolveFairWorld(player, hand) {
      const value=state[player][hand]; if(value<=0) return false;
      for(const p of ["human","cpu"]) for(const h of ["L","R"]) if(state[p][h]>0) state[p][h]=value;
      state.mode="attack"; state.pendingTerminalEnd[player]=true; addLog(`${handNames[player]}の「平等な世界」により、すべての生存している手が${value}になった。`); clearBrokenTraps("human"); clearBrokenTraps("cpu"); render(); if(player==="human") await forcePublishFriendStateNow("fair world"); return true;
    }
    async function resolveEqualCondemnation(player) {
      if (!isBalanced(player)) {
        addLog(`${handNames[player]}の「等価なる断罪」は自分の両手が均衡していないため不発。`);
        return false;
      }
      const o=otherPlayer(player); if(isBalanced(o)){addLog(`「等価なる断罪」は相手も均衡しているため無効。`); state.pendingTerminalEnd[player]=true; return false;}
      const amount=state[player].L;
      for(const h of ["L","R"]) if(state[o][h]>0){ await addFingersWithCalculation(o,h,amount,"等価なる断罪",true); if(checkWin()) break; }
      state.pendingTerminalEnd[player]=true;
      return true;
    }
    async function resolveUnfairWorld(player) {
      for(const p of ["human","cpu"]) for(const h of ["L","R"]) if(state[p][h]>0) state[p][h]=1+Math.floor(Math.random()*4);
      addLog(`${handNames[player]}の「不平等な世界」により、すべての生存している手が個別に振り直された。`); state.pendingTerminalEnd[player]=true; render(); if(player==="human") await forcePublishFriendStateNow("unfair world");
    }
    async function resolveDivinePunishment(player) {
      for(let i=0;i<4;i++){
        const candidates=[]; for(const p of ["human","cpu"]) for(const h of ["L","R"]) if(state[p][h]>0)candidates.push({p,h});
        if(!candidates.length||checkWin()) break; const x=candidates[Math.floor(Math.random()*candidates.length)]; await addFingersWithCalculation(x.p,x.h,1,"天罰",true); if(checkWin()) break;
      }
      state.pendingTerminalEnd[player]=true;
    }
    async function beginExecution(player) {
      const o=otherPlayer(player), l=state[o].L, r=state[o].R;
      if (state.battleMode === "friend" && player === "human") {
        await emitFriendFx("executionCinematic", { playerSide: friendSideForLocalPlayer(player) }).catch(error => console.error("PVP execution cinematic fx failed", error));
      }
      await showExecutionCinematic(player);
      if(l>0&&r>0&&l===r&&player==="human"){state.mode="executionTarget";setMessage("「執行」：0にする相手の手を選んでください。");return;}
      let h=l>=r?"L":"R"; if(state[o][h]<=0)h=otherHand(h);
      if (state.battleMode === "friend" && player === "human") {
        await emitFriendFx("executionStrike", {
          playerSide: friendSideForLocalPlayer(player),
          targetSide: friendSideForLocalPlayer(o),
          targetHand: h
        }).catch(error => console.error("PVP execution strike fx failed", error));
      }
      await showExecutionTargetSeal(o, h);
      const before=state[o][h];state[o][h]=0;markDirectiveOpponentZero(player,o,before); clearBrokenTraps(o); state.pendingTerminalEnd[player]=true; addLog(`${handNames[player]}の「執行」により${handNames[o]}の${handNames[h]}が0になった。`); render(); if(player==="human")await forcePublishFriendStateNow("execution"); checkWin();
    }

    function beginChargeTargetEffect(player, cardId) {
      state.pendingChargeTarget = { player, cardId };
      if (player === "human") {
        if (cardId === "electromagneticInduction") {
          state.mode = "chargeTargetOwn";
          setMessage(`「${CARD_LIBRARY[cardId].name}」：変更する自分の手を選んでください。`);
        } else {
          state.mode = "chargeTargetOpponent";
          setMessage(`「${CARD_LIBRARY[cardId].name}」：対象にする相手の手を選んでください。`);
        }
        render();
        return;
      }

      const opponent = player === "human" ? "cpu" : "human";
      if (cardId === "electromagneticInduction") {
        const choices = ["L", "R"].filter(hand => state[player][hand] > 0);
        const hand = choices.sort((a, b) => state[player][a] - state[player][b])[0] || "L";
        resolveChargeTargetEffect(player, player, hand, cardId);
      } else {
        const choices = ["L", "R"].filter(hand => state[opponent][hand] > 0);
        const hand = choices.sort((a, b) => state[opponent][b] - state[opponent][a])[0] || "L";
        resolveChargeTargetEffect(player, opponent, hand, cardId);
      }
    }

    async function maybePreventLethalWithEmc2(player, hand, finalValue, sourceLabel = "攻撃", isLogicAtelier = false) {
      if (finalValue !== 0 || state[player][otherHand(hand)] > 0) return finalValue;

      const handIndex = state.hands[player].indexOf("emc2");
      const required = isLogicAtelier ? 10 : 6;
      const charge = getChargeLevel(player);
      if (handIndex < 0 || charge < required) return finalValue;

      // 敗北回避は処理の取りこぼしを防ぐため自動発動。
      state.hands[player].splice(handIndex, 1);
      state.discard[player].push("emc2");
      setChargeLevel(player, 0);
      addLog(`${handNames[player]}は「E=mc²」を発動。${sourceLabel}による敗北を防ぎ、${handNames[hand]}で4に踏みとどまった。`);
      await showPopup(
        player,
        "E = mc²",
        `<div class="emc2-main">MASS–ENERGY CONVERSION</div><div class="emc2-sub">充電Lv.${charge}を全消費<br>${handNames[hand]}で4に踏みとどまる</div>`,
        "emc2",
        1200,
        true
      );
      return 4;
    }

    async function applyDirectChargeDamage(attacker, defender, targetHand, rawAmount, sourceLabel, isLogicAtelier = false) {
      if (state[defender][targetHand] <= 0) return false;
      const amount = applyGuardBlessingReduction(defender, targetHand, Math.max(0, rawAmount), sourceLabel);
      const before = state[defender][targetHand];
      const total = before + amount;
      let finalValue = normalize(total, defender, targetHand);
      finalValue = await maybePreventLethalWithEmc2(defender, targetHand, finalValue, sourceLabel, isLogicAtelier);
      await animateCalculation(defender, targetHand, total, finalValue);
      state[defender][targetHand] = finalValue;
      addLog(`${handNames[attacker]}の「${sourceLabel}」：${handNames[defender]}の${handNames[targetHand]} ${before}→${total}${total >= 5 ? `→${finalValue}` : ""}。`);
      clearBrokenTraps(defender);
      render();
      checkWin();
      return true;
    }

    async function resolveChargeTargetEffect(player, owner, hand, cardId) {
      const opponent = player === "human" ? "cpu" : "human";
      state.pendingChargeTarget = null;
      state.mode = "attack";

      if (cardId === "electric") {
        const beforeCharge = getChargeLevel(player);
        const damage = Math.floor(beforeCharge / 3);
        await applyDirectChargeDamage(player, opponent, hand, damage, "エレクトリック");
        setChargeLevel(player, Math.floor(beforeCharge / 2));
        addLog(`${handNames[player]}の充電は「エレクトリック」によりLv.${beforeCharge}→Lv.${Math.floor(beforeCharge / 2)}。`);
        await endTurn();
        return;
      }

      if (cardId === "electromagneticWave") {
        const before = state[opponent][hand];
        let finalValue = Math.floor(before / 2);
        finalValue = await maybePreventLethalWithEmc2(opponent, hand, finalValue, "電磁波");
        state[opponent][hand] = finalValue;
        addLog(`${handNames[player]}の「電磁波」：${handNames[opponent]}の${handNames[hand]}を${before}→${finalValue}。`);
        clearBrokenTraps(opponent);
        render();
        checkWin();
        return;
      }

      if (cardId === "laserBeam") {
        const charge = getChargeLevel(player);
        setChargeLevel(player, 0);
        await applyDirectChargeDamage(player, opponent, hand, charge, "レーザービーム");
        await endTurn();
        return;
      }

      if (cardId === "electromagneticInduction") {
        const charge = getChargeLevel(player);
        const before = state[player][hand];
        let finalValue = normalize(charge, player, hand);
        finalValue = await maybePreventLethalWithEmc2(player, hand, finalValue, "電磁誘導");
        state[player][hand] = finalValue;
        addLog(`${handNames[player]}の「電磁誘導」：${handNames[hand]}を${before}→${charge}${charge >= 5 ? `→${finalValue}` : ""}。`);
        clearBrokenTraps(player);
        render();
        checkWin();
      }
    }

    function triggerChemicalGeneration(player, usedCardId) {
      if (usedCardId === "charge" || usedCardId?.startsWith("charge_")) return;
      const count = countOwnAttachment(player, "chemicalGeneration");
      if (count <= 0) return;
      gainCharge(player, count, "化学発電");
    }

    function normalizeChargeHand(player){ const e=getChargeEntries(player); if(!e.length)return; const lv=Math.max(...e.map(x=>x.level)); state.hands[player]=state.hands[player].filter(id=>!chargeLevelFromId(id)); state.hands[player].push(ensureChargeDefinition(lv)); }
    function setChargeLevel(player,level){ const lv=Math.max(0,Math.min(10,Number(level)||0)); state.hands[player]=state.hands[player].filter(id=>!chargeLevelFromId(id)); if(lv>0) state.hands[player].push(ensureChargeDefinition(lv)); return lv; }
    function gainCharge(player,amount,source="充電効果"){ normalizeChargeHand(player); const before=getChargeLevel(player); const gain=Math.max(0,Number(amount)||0); if(before>=10||gain<=0){ if(before>=10)addLog(`${handNames[player]}は既に充電Lv.10のため充電を得られない。`); return before; } const after=Math.min(10,before+gain); setChargeLevel(player,after); addLog(`${handNames[player]}は${source}で充電${gain}を得た（Lv.${before}→Lv.${after}）。`); return after; }
    function consumeCharge(player,amount,allowPartial=false,source="充電消費"){ const before=getChargeLevel(player); const need=Math.max(0,Number(amount)||0); if(!allowPartial&&before<need){ addLog(`${handNames[player]}の「${source}」は充電不足（必要${need}/現在${before}）で不発。`); return false; } const spent=allowPartial?Math.min(before,need):need; setChargeLevel(player,before-spent); addLog(`${handNames[player]}は${source}で充電${spent}を消費（Lv.${before}→Lv.${before-spent}）。`); return true; }
    function isProtectedChargeCard(cardId){ return chargeLevelFromId(cardId)>0; }
    function countDiscardableHand(player){ return state.hands[player].filter(isExternallyDiscardableHandCard).length; }
    function canUseChargeCardDuringLightSpeed(player, cardId) {
      const card = CARD_LIBRARY[cardId];
      return !!state.temp?.[player]?.lightSpeedCircuit && !!card?.chargeCard;
    }
    function chargeCardUsageKey(cardId) {
      return cardId;
    }

    function hasUsedChargeCardThisTurn(player, cardId) {
      if (!CARD_LIBRARY[cardId]?.chargeCard) return false;
      const used = state.temp?.[player]?.chargeCardsUsed;
      return Array.isArray(used) && used.includes(chargeCardUsageKey(cardId));
    }

    function canUseChargeCardThisTurn(player, cardId) {
      return !CARD_LIBRARY[cardId]?.chargeCard || !hasUsedChargeCardThisTurn(player, cardId);
    }

    function markChargeCardUsedThisTurn(player, cardId) {
      if (!CARD_LIBRARY[cardId]?.chargeCard) return;
      if (!Array.isArray(state.temp[player].chargeCardsUsed)) state.temp[player].chargeCardsUsed = [];
      const key = chargeCardUsageKey(cardId);
      if (!state.temp[player].chargeCardsUsed.includes(key)) state.temp[player].chargeCardsUsed.push(key);
    }

    function isChargeCardId(cardId){ return !!CARD_LIBRARY[cardId]?.chargeCard; }
    async function resolveDimensionalSlash(player, hand) {
      const charge = getChargeLevel(player);
      if (charge < 5) {
        addLog(`${handNames[player]}の「空間切断」は充電不足で不発。`);
        state.mode = "attack";
        render();
        return false;
      }

      if (hand) {
        hand = hand === "R" ? "R" : "L";
        const currentValue = Number(state[player]?.[hand] || 0);
        if (currentValue <= 0) {
          addLog(`${handNames[player]}の「空間切断」は、代償にする手がすでに0だったため発動しなかった。`);
          state.mode = "dimensionalSlashSacrifice";
          render();
          return false;
        }

        const before = state[player][hand];

        // 自傷はダメージではなく発動前の代償。選択した手を確実に0にする。
        state[player][hand] = 0;
        // 0になった手の罠・加護・呪縛は既存の共通処理で整理する。
        // 以前は未定義の clearHandAttachments() を呼んでおり、充電5～9時にここで処理が停止していた。
        clearBrokenTraps(player);
        addLog(`${handNames[player]}は「空間切断」の代償として${handNames[hand]}を${before}→0にした。`);
        render();

        if (state.battleMode === "friend" && player === "human") {
          try {
            state.friendLastPublishedSignature = "";
            await publishFriendStateNow();
          } catch (error) {
            console.error("PVP dimensional slash sacrifice sync failed", error);
            scheduleFriendStatePublish();
          }
        }

        // 最後の手を代償にした場合は、その場で敗北。強化は付与しない。
        if (checkWin()) {
          state.mode = "attack";
          setMessage("「空間切断」の代償で両手が0になったため敗北しました。");
          render();
          return false;
        }
      }

      if (!consumeCharge(player, 5, false, "空間切断")) {
        state.mode = "attack";
        render();
        return false;
      }

      state.temp[player].dimensionalSlashBonus =
        (state.temp[player].dimensionalSlashBonus || 0) + 1;
      state.temp[player].attackLimit =
        Math.max(2, state.temp[player].attackLimit || 1);
      state.temp[player].multiAttackSource = "空間切断";
      state.mode = "attack";
      setMessage("「空間切断」：このターン、通常攻撃で加える本数+1。通常攻撃を2回まで行えます。");
      render();

      if (state.battleMode === "friend" && player === "human") {
        state.friendLastPublishedSignature = "";
        await publishFriendStateNow().catch(error => {
          console.error("PVP dimensional slash activation sync failed", error);
          scheduleFriendStatePublish();
        });
      }
      return true;
    }

    function isEffectCopyExcluded(cardId, source = "") {
      if (!cardId) return true;
      if (isDirectiveCard(cardId)) return true;
      if (isProtectedChargeCard(cardId)) return true;
      const card = CARD_LIBRARY[cardId];
      if (card?.copyExcluded) return true;
      if (source === "brawl" && card?.brawlExcluded) return true;
      if (source === "advanceNotice" && card?.advanceNoticeExcluded) return true;
      if (cardId === "logicAtelier") return true;
      if (source === "brawl" && cardId === "brawl") return true;
      if (source === "advanceNotice" && cardId === "advanceNotice") return true;
      return false;
    }

    function getBrawlCandidates(player) {
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => {
          const card = CARD_LIBRARY[item.cardId];
          return card && typeof card.effect === "function" && !isEffectCopyExcluded(item.cardId, "brawl") && canUseCardUnderRule(player,item.cardId,{silent:true});
        });
    }

    function getAdvanceNoticeCandidates(player) {
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => {
          const card = CARD_LIBRARY[item.cardId];
          if (!card || typeof card.effect !== "function" || isEffectCopyExcluded(item.cardId, "advanceNotice") || !canUseCardUnderRule(player,item.cardId,{silent:true})) return false;
          if (!canUseChargeCardThisTurn(player, item.cardId)) return false;
          try {
            return !!card.canPlay(player);
          } catch {
            return false;
          }
        });
    }

    async function activateCopiedCardEffect(player, cardId, sourceLabel, context = {}) {
      const effectiveId = effectiveCardIdForPlayer(player, cardId);
      const card = CARD_LIBRARY[effectiveId];
      if (!card || typeof card.effect !== "function") {
        addLog(`${sourceLabel}で選ばれたカードには発動できる効果がなかった。`);
        return false;
      }
      if (!canUseCardUnderRule(player, effectiveId)) {
        addLog(`${sourceLabel}で選ばれた「${card.name}」は特殊ルールにより発動できなかった。`);
        return false;
      }

      // 乱闘・予告状の発動は「カードの効果だけを使う」ため、
      // 充電カードの1ターン1回制限を確認せず、使用済みにも記録しない。
      const previousCopy = state.copiedEffectContext;
      const previousEffectPlayer = state.resolvingEffectPlayer;
      state.copiedEffectContext = { sourceLabel, cardId, ...context };
      state.resolvingEffectPlayer = player;
      try {
        recordRondoUse(player, effectiveId);
        await card.effect(player);
        if (card.terminal && !state.pendingTerminalEnd[player] && state.mode === "attack") {
          state.pendingTerminalEnd[player] = true;
        }
        return true;
      } finally {
        state.copiedEffectContext = previousCopy;
        state.resolvingEffectPlayer = previousEffectPlayer;
      }
    }

    async function chooseAdvanceNoticeCard(player, handIndex) {
      if (state.mode === "advanceNoticeChoose" && player === "human" && state.turn !== "human") return false;
      const cardId = state.hands[player][handIndex];
      if (!canUseCardUnderRule(player, cardId)) return false;
      const valid = getAdvanceNoticeCandidates(player).some(item => item.index === handIndex && item.cardId === cardId);
      if (!valid) {
        if (player === "human") {
          const attemptedId = state.hands[player][handIndex];
          const attemptedCard = CARD_LIBRARY[attemptedId];
          if (attemptedCard?.chargeCard && hasUsedChargeCardThisTurn(player, attemptedId)) {
            setMessage(`「${attemptedCard.name}」はこのターンすでに使用しているため予告できません。`);
          } else {
            setMessage("そのカードは現在の条件では予告できません。");
          }
        }
        return false;
      }
      const card = CARD_LIBRARY[cardId];

      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        emitFriendFx("advanceNoticeReveal", {
          playerSide: friendSideForLocalPlayer(player),
          cardId
        }).catch(error => console.error("PVP advance notice reveal fx failed", error));
      }
      await showAdvanceNoticeRevealPopup(player, card, 1100);

      // 予告状は発動時ではなく、公開した宣言ターンにカードを使った扱いにする。
      markChargeCardUsedThisTurn(player, cardId);
      await discardHandCardByEffect(player, handIndex);
      state.pendingAdvanceNotice[player] = state.pendingAdvanceNotice[player] || [];
      state.pendingAdvanceNotice[player].push(cardId);
      state.mode = "attack";
      addLog(`${handNames[player]}は「予告状」で「${card.name}」を公開し、捨て札にした。次の自分のターン開始時に効果が発動する。`);
      setLastAction(player, "予告状", `「${card.name}」を公開して予告しました。`, "card");
      if (player === "human") setMessage(`「予告状」：次の自分のターン開始時に「${card.name}」の効果が発動します。`);
      render();
      return true;
    }

    async function resolveAdvanceNotice(player) {
      const queue = [...(state.pendingAdvanceNotice?.[player] || [])];
      state.pendingAdvanceNotice[player] = [];
      for (const cardId of queue) {
        const card = CARD_LIBRARY[cardId];
        if (!card) continue;
        if (!canUseCardUnderRule(player, cardId)) { addLog(`【予告状】「${card.name}」は特殊ルールにより発動しなかった。`); continue; }
        addLog(`【予告状】${handNames[player]}が予告した「${card.name}」の効果が発動する。`);
        await showCardPopup(player, card, false, player === "cpu" ? 760 : 650);
        await activateCopiedCardEffect(player, cardId, "予告状");
        if (state.gameOver || state.pendingTerminalEnd[player] || state.mode !== "attack") break;
      }
    }

    let fatigueFxQueue = Promise.resolve();

    function queueFatiguePopup(player, detail) {
      const turnStartContext=state.friendTurnStartAtomicActive?cloneJson(state.friendTurnStartAtomicContext):null;
      const title = "疲労";
      const text = detail.kind === "discard"
        ? `<div class="fatigue-popup-main">山札切れ</div><div>手札から「${escapeHtml(detail.cardName)}」をランダムに捨てました。</div>`
        : `<div class="fatigue-popup-main">山札切れ</div><div>${handNames[detail.hand]}が ${detail.before} → ${detail.after}</div>`;

      fatigueFxQueue = fatigueFxQueue
        .catch(() => {})
        .then(async () => {
          const contextKey=friendTurnStartContextKey(turnStartContext),sameAtomic=contextKey&&contextKey===friendTurnStartContextKey(state.friendTurnStartAtomicContext),committed=contextKey&&state.friendTurnStartCommittedContexts.has(contextKey);
          if(contextKey&&!sameAtomic&&!committed)return;
          await showPopup(player, title, text, "fatigue", 720, true);
          if (state.battleMode === "friend" && player === "human" && !state.friendApplyingRemoteState) {
            const stillAtomic=contextKey&&contextKey===friendTurnStartContextKey(state.friendTurnStartAtomicContext),committedAfter=contextKey&&state.friendTurnStartCommittedContexts.has(contextKey);
            if(contextKey&&!stillAtomic&&!committedAfter)return;
            const fxPayload={
              playerSide: friendSideForLocalPlayer(player),
              ...detail
            };
            if(committedAfter){
              const fx={id:`${state.friendRole}-fx-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,type:"fatigue",sourceSide:state.friendRole,payload:cloneJson(fxPayload),createdAtMs:Date.now()};
              await writeFriendFxNow(fx,turnStartContext);
            }else{
              await emitFriendFx("fatigue",fxPayload);
              state.friendLastPublishedSignature = "";
              await publishFriendStateNow();
            }
          }
        })
        .catch(error => console.error("疲労演出・同期エラー", error));
    }

    function drawCard(player) {
      if (state.activeDrawLock?.[player]) return false;
      if (state.decks[player].length > 0) {
        const cardId = state.decks[player].pop();
        state.hands[player].push(materializeDrawnCard(cardId));
        ensureHandCardInstances(player);state.handCardInstances[player][state.hands[player].length-1]=`ci-${++state.cardInstanceSequence}`;
        return true;
      }

      fatigue(player);
      return false;
    }

    function fatigue(player) {
      const discardableCards = getCountedHandCards(player).filter(item=>canDiscardHandCard(player,item.index,"fatigue"));
      if (discardableCards.length > 0) {
        const picked = discardableCards[Math.floor(Math.random() * discardableCards.length)];
        const [discarded] = state.hands[player].splice(picked.index, 1);
        state.handCardInstances[player].splice(picked.index,1);
        state.discard[player].push(discarded);
        const cardName = CARD_LIBRARY[discarded]?.name || discarded;
        addLog(`${handNames[player]}は疲労を受け、手札から「${cardName}」をランダムに捨てた。`);
        queueFatiguePopup(player, { kind: "discard", cardId: discarded, cardName });
        render();
        return;
      }

      // 充電しか持っていない場合、疲労では「手札0枚」として扱う。
      const candidates = ["L", "R"].filter(hand => isAlive(player, hand));
      if (!candidates.length) {
        checkWin();
        return;
      }

      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const before = state[player][target];
      const after = Math.max(0, before - 1);
      state[player][target] = after;
      addLog(`${handNames[player]}は疲労を受け、${handNames[target]}が${before}→${after}になった。`);
      clearBrokenTraps(player);
      queueFatiguePopup(player, { kind: "hand", hand: target, before, after });
      render();
      checkWin();
    }

    function canNormallyUseHandCard(player, handIndex) {
      if (state.startingRouletteActive || state.gameOver || state.turn !== player || state.animating || (player==="human"&&isFriendInteractionBlocking())) return false;
      if (state.furiosoSkipActive?.[player] || state.quarterRestActive?.[player]) return false;
      if ((state.judgmentPrisonTurns?.[player] || 0) > 0 || state.activeIntemperanceCardLock?.[player]) return false;
      const rawCardId = state.hands[player]?.[handIndex];
      const cardId = effectiveCardIdForPlayer(player, rawCardId);
      const card = CARD_LIBRARY[cardId];
      if (!card || cardId === "performance") return false;
      if (Array.isArray(state.temp[player]?.terminalCardBanIds) && state.temp[player].terminalCardBanIds.includes(cardId)) return false;
      const setupActive = !!state.temp[player]?.setupMode;
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed(player, cardId);
      const hasCardAllowance = !state.temp[player]?.cardActionUsed || Number(state.temp[player]?.cardExtraUses || 0) > 0 || lightSpeedChargePlayable || (setupActive && card.trap);
      if (!hasCardAllowance || !canUseChargeCardThisTurn(player, cardId)) return false;
      if (state.activeCostLimit?.[player] !== null && state.activeCostLimit?.[player] !== undefined && card.cost > state.activeCostLimit[player]) return false;
      if (state.berserkerTurns?.[player] > 0 && !state.temp[player]?.berserkerJustUsed) return false;
      if (isAttachmentCard(cardId)) {
        if (setupActive && !card.trap) return false;
        return canSetAttachmentTarget(player, cardId);
      }
      if (setupActive) return false;
      try { return typeof card.canPlay !== "function" || !!card.canPlay(player); } catch (_) { return false; }
    }

    function getNormallyPlayableHandCards(player) {
      return (state.hands[player] || []).map((cardId, index) => ({ cardId, index })).filter(item => canNormallyUseHandCard(player, item.index));
    }

    function shouldAutoEndTurnForNoActions(player) {
      if (state.activeExtraAction?.[player] || Number(state.extraActions?.[player] || 0) > 0) return false;
      const temp=state.temp?.[player]||{};
      const attackLimit=Math.max(0,Number(temp.attackLimit??1));
      const attacksUsed=Math.max(0,Number(temp.attacksUsed||0));
      const hasNormalAttack=canUseNormalAttackAction(player)&&Math.max(0,attackLimit-attacksUsed)>0;
      return !hasNormalAttack&&getNormallyPlayableHandCards(player).length===0;
    }

    async function maybeAutoEndTurnForNoActions(player, options = {}) {
      if(isFriendInteractionBlocking())return false;
      if (state.gameOver || state.turn !== player || state.mode !== "attack") return false;
      if (state.pendingTerminalEnd?.[player] || state.autoEndingNoActions?.[player]) return false;
      if (!shouldAutoEndTurnForNoActions(player)) return false;

      state.autoEndingNoActions = state.autoEndingNoActions || { human: false, cpu: false };
      state.autoEndingNoActions[player] = true;
      const displayName=getPlayerDisplayName(player,{includeYou:state.battleMode==="friend"});
      addLog(`${displayName}は使用できるカードも通常攻撃可能回数もないため、ターンを終了した。`);
      setMessage(`${displayName}は使用できるカードも通常攻撃可能回数もないため、ターンを終了します。`);
      render();
      try {
        if (!options.skipDelay) await delay(220);
        if (state.gameOver || state.turn !== player || state.pendingTerminalEnd?.[player]) return false;
        await commitFriendTurnStartBeforeImmediateEnd(player,options);
        await endTurn(options.reason||"no-actions auto end");
        return true;
      } finally {
        state.autoEndingNoActions[player] = false;
      }
    }

    async function commitFriendTurnStartBeforeImmediateEnd(player, options = {}) {
      if(state.battleMode!=="friend"||player!=="human"||!options.friendTurnKey)return true;
      if(Number(state.friendTurnStartAppliedSerial||0)>=Number(options.friendTurnSerial||state.friendTurnSerial||0))return true;
      await commitFriendTurnStartApplied(options);
      return true;
    }

    async function startTurn(player,options={}) {
      const friendTurnKey=state.battleMode==="friend"&&player==="human"?String(options.friendTurnKey||""):"";
      if(!friendTurnKey)return startTurnCore(player,options);
      if(state.friendStartedTurnKey===friendTurnKey)return true;
      if(state.friendStartingTurnKey===friendTurnKey)return false;
      state.friendStartingTurnKey=friendTurnKey;
      try{
        await startTurnCore(player,options);
        const requiredAppliedSerial=Number(options.friendTurnSerial||state.friendTurnSerial||0);
        if(options.friendTurnToken&&Number(state.friendTurnStartAppliedSerial||0)<requiredAppliedSerial)throw new Error("ターン開始stateを確定できませんでした。");
        state.friendStartedTurnKey=friendTurnKey;
        return true;
      }finally{
        if(state.friendStartingTurnKey===friendTurnKey)state.friendStartingTurnKey="";
      }
    }

    function computeTurnAttackLimit({directiveAttackDelta=0,lateBonus=0,otherDelta=0}={}){
      return Math.max(0,1+Number(directiveAttackDelta||0)+Number(lateBonus||0)+Number(otherDelta||0));
    }

    async function startTurnCore(player,options={}) {
      if (isTutorialBattle()) {
        if (player === "cpu") {
          freezeTutorialBattleToHumanTurn();
          return;
        }
        state.turn = "human";
        state.mode = "attack";
        state.selectedAttackHand = null;
        state.gameOver = false;
        render();
        return;
      }
      ensureOnlineStateMaps();
      state.resonanceTriggeredThisTurn[player]=false;
      state.activeDrawLock[player]=!!state.pendingDrawLock[player]; state.pendingDrawLock[player]=false;
      state.quarterRestActive[player]=!!state.quarterRestPending[player]; state.quarterRestPending[player]=false;
      state.wholeRestActive[player]=!!state.wholeRestPending[player]; state.wholeRestPending[player]=false;
      state.furiosoSkipActive[player]=!!state.furiosoSkipPending[player]; state.furiosoSkipPending[player]=false;
      ensureThemeAttachments(player);
      // 「指令の加護」は直前の相手ターンだけ有効。自分の新しいターン開始時に失効する。
      if (state.activeDirectiveBlessing) state.activeDirectiveBlessing[player] = 0;
      // ターン開始時点ですでに予約されていた反動だけを「今回の反動」として確定する。
      // 予告状など、ターン開始処理の途中で新しく予約された反動は次の自分ターンまで残す。
      const chargeStunDueThisTurn = !!state.pendingChargeStun[player];
      const chargeStunSourceDueThisTurn = state.pendingChargeStunSource?.[player] || "充電効果";
      if (chargeStunDueThisTurn) {
        state.pendingChargeStun[player] = false;
        state.pendingChargeStunSource[player] = "";
      }
      if (!state.firstTurnStarted) state.firstTurnStarted = { human: false, cpu: false };
      if (!state.pendingNoDraw) state.pendingNoDraw = { human: 0, cpu: 0 };
      if (!state.activeNoDraw) state.activeNoDraw = { human: 0, cpu: 0 };
      state.firstTurnStarted[player] = true;
      state.turn = player;
      const romanBeforeTurnStart=isRomanPreparation();
      state.personalTurnCount[player] = Number(state.personalTurnCount[player] || 0) + 1;
      if(romanBeforeTurnStart&&!isRomanPreparation()){addLog("ロマンギミック杯：双方の準備時間が終了した。戦闘開始。");setMessage("準備時間終了 ― 戦闘開始");}
      const directiveOpponent=otherPlayer(player);
      state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0, naturalFaithActive:false, opponentZeroedThisTurn:false, opponentHandsAtTurnStart:{L:state[directiveOpponent].L,R:state[directiveOpponent].R}, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.nobleGasProtected[player]=false;
      const lateBonus=Number(state.pendingLateAttackBonus[player]||0);state.pendingLateAttackBonus[player]=0;
      if(state.forcedCard[player]?.pending){state.forcedCard[player].pending=false;state.forcedCard[player].active=true;}
      if(["L","R"].some(h=>hasAttachment(player,h,"sniperBlessing"))){state.hands[player].push("supportFire");ensureHandCardInstances(player);addLog(`${handNames[player]}の「狙撃の加護」により「援護射撃」が1枚加わった。`);}
      const directiveAttackDelta=Number(state.pendingDirectiveAttackLimitDelta[player]||0);state.pendingDirectiveAttackLimitDelta[player]=0;state.temp[player].attackLimit=computeTurnAttackLimit({directiveAttackDelta,lateBonus});
      state.activeDirectiveReformContinue[player]=!!state.pendingDirectiveReformContinue[player];state.pendingDirectiveReformContinue[player]=false;
      state.noSplit[player]=!!state.noSplit[player]||!!state.pendingDirectiveNoSplit[player];state.pendingDirectiveNoSplit[player]=false;
      state.activeDirectiveAnnihilation[player]=!!state.pendingDirectiveAnnihilation[player];state.pendingDirectiveAnnihilation[player]=false;
      if(state.pendingDeusVult[player]){state.pendingDeusVult[player]=false;state.hands[player].push("deusVult");addLog(`${handNames[player]}の手札に「DEUS VULT」が加わった。神意は証明された。`);}
      state.turn = player;
      state.mode = "attack";
      state.selectedAttackHand = null;
      if(state.pendingYellowWaspNeedle?.[player]){
        state.pendingYellowWaspNeedle[player]=false;
        const result=await recoverHarpoon(player,{sourceLabel:"黄蜂針"});
        if(result.zeroed&&result.targetPlayer===otherPlayer(player)){drawCard(player);drawCard(player);addLog(`「黄蜂針」の回収で相手の手を0にしたため、${handNames[player]}は2枚引いた。`);}
        if(checkWin())return;
      }
      const reservedExecutions = Number(state.pendingAppealExecution?.[player] || 0);
      if (reservedExecutions > 0) {
        for (let i = 0; i < reservedExecutions; i++) state.hands[player].push("execution");
        state.pendingAppealExecution[player] = 0;
        addLog(`${handNames[player]}のターン開始時、上告の判決により「執行」を${reservedExecutions}枚得た。`);
        await showPopup(
          player,
          "上告の判決",
          `<div class="intemperance-lock-main">執行 ×${reservedExecutions}</div><div>次ターン開始時の付与が執行されました。</div>`,
          "card-detail",
          1050,
          true
        );
      }
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingRepairDiscard = null;
      state.pendingEqualTradeSelf = null;
      state.pendingRapidFireDiscard = null;
      state.pendingGunEffect = null;
      state.pendingFanning = null;
      state.pendingModulation = null;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      clearHighlights();

      state.pendingTerminalEnd[player] = false;
      state.activeExtraAction[player] = false;
      state.activeIntemperanceCardLock[player] = !!state.pendingIntemperanceCardLock[player];
      state.activeCardUseLockSource[player] = state.activeIntemperanceCardLock[player]
        ? (state.pendingCardUseLockSource[player] || "intemperance")
        : "";
      state.pendingIntemperanceCardLock[player] = false;
      state.pendingCardUseLockSource[player] = "";
      state.activeCostLimit[player] = state.costLimitNextTurn[player];
      state.costLimitNextTurn[player] = null;
      if (state.quarterRestActive[player]) await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: "quarterRest" });
      if (state.wholeRestActive[player]) await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: "wholeRest" });
      if (state.berserkerTurns[player] > 0) await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: "berserker" });
      if ((state.judgmentPrisonTurns?.[player] || 0) > 0) await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: "prison" });
      if (state.activeIntemperanceCardLock[player]) {
        await showTurnRestrictionPopup({
          targetPlayer: player,
          restrictionType: cardUseLockRestrictionType(player)
        });
      }
      if(state.noSplit[player])await showTurnRestrictionPopup({targetPlayer:player,restrictionType:"directiveReform"});
      if(state.activeDirectiveReformContinue[player])await showTurnRestrictionPopup({targetPlayer:player,restrictionType:"directiveReformSuccess"});
      if(state.activeDirectiveAnnihilation[player])await showTurnRestrictionPopup({targetPlayer:player,restrictionType:"directiveAnnihilation"});
      if(directiveAttackDelta!==0)await showTurnRestrictionPopup({targetPlayer:player,restrictionType:directiveAttackDelta>0?"directiveComboSuccess":"directiveComboFailure"});
      if ((state.energyBarrier[player] || 0) > 0) {
        state.energyBarrier[player] = 0;
        addLog(`${handNames[player]}の「エネルギーバリア」が終了した。`);
      }

      if ((state.cheapBatteryDecay[player] || 0) > 0) {
        const beforeCharge = getChargeLevel(player);
        setChargeLevel(player, Math.max(0, beforeCharge - 2));
        state.cheapBatteryDecay[player] -= 1;
        const remaining = state.cheapBatteryDecay[player];
        addLog(`${handNames[player]}の「廉価バッテリー」が劣化。充電Lv.${beforeCharge}→Lv.${Math.max(0, beforeCharge - 2)}。残り${remaining}回。`);
        await showPopup(
          player,
          "廉価バッテリー劣化",
          `<div class="battery-decay-main">充電 -2</div><div>残り劣化回数：${remaining}回</div>`,
          "charge-recoil",
          900,
          true
        );
      }

      const solarCount = countOwnAttachment(player, "solarGeneration");
      if (solarCount > 0) gainCharge(player, solarCount * 2, "太陽光発電");

      // 魔法少女のターン開始効果。ここで例外が出るとターン移行全体が止まるため、
      // 必ず共通のdrawCard()を使い、実行内容をログへ残す。
      state.pendingMagicalHeartDraw = state.pendingMagicalHeartDraw || { human: 0, cpu: 0 };
      const magicalHeartDraw = Number(state.pendingMagicalHeartDraw[player] || 0);
      if (magicalHeartDraw > 0) {
        state.pendingMagicalHeartDraw[player] = 0;
        for (let i=0;i<magicalHeartDraw;i++) drawCard(player);
      }

      const greedCount = countOwnAttachment(player, "magicalGreed");
      if (greedCount > 0) {
        let greedDrawn = 0;
        for (let i = 0; i < greedCount * 2; i++) {
          if (drawCard(player)) greedDrawn += 1;
        }
        const greedDiscarded = await discardRandomCards(player, greedCount * 2, "「貪欲」");
        addLog(
          `${handNames[player]}の「貪欲」が発動。` +
          `${greedDrawn}枚引き、手札からランダムに${greedDiscarded}枚捨てた。`
        );
      }
      const wrathCount = countOwnAttachment(player, "magicalWrath");
      if (wrathCount > 0) {
        let wrathDrawn = 0;
        for (let i = 0; i < wrathCount; i++) {
          if (drawCard(player)) wrathDrawn += 1;
        }
        addLog(`${handNames[player]}の「憤怒」が発動。追加で${wrathDrawn}枚引いた。`);
      }

      const pendingTorrent = state.pendingWillTorrent[player] || 0;
      state.pendingWillTorrent[player] = 0;
      for (let i = 0; i < pendingTorrent; i++) {
        state.hands[player].push("willTorrent");
      }
      if (pendingTorrent > 0) {
        addLog(`${handNames[player]}は「不吉な力」により「意志の奔流」を${pendingTorrent}枚得た。`);
      }

      const scheduledDirectives = state.pendingDirectiveDraw[player] || 0;
      state.pendingDirectiveDraw[player] = 0;
      for (let i = 0; i < scheduledDirectives; i++) {
        if (!drawDirectiveFromDeck(player)) break;
      }
      if (scheduledDirectives > 0) {
        addLog(`${handNames[player]}は「指令の意味」により山札から指令を最大${scheduledDirectives}枚加えた。`);
      }

      if (state.berserkerTurns[player] > 0) {
        addLog(`${handNames[player]}はバーサーカー状態。攻撃+2、カード使用・罠設置・分ける不可。攻撃で対象が7以上になった場合は0。残り${state.berserkerTurns[player]}ターン。`);
      }

      let draws = 1;
      if ((state.pendingDirectiveNoDraw[player] || 0) > 0) {
        state.pendingDirectiveNoDraw[player] -= 1;
        draws = 0;
        addLog(`${handNames[player]}は未達成の「指令：沈黙」により、このターンの通常ドローを行わない。`);
      }
      if (state.pendingStartDrawSkip[player]) {
        state.pendingStartDrawSkip[player] = false;
        if (draws > 0) draws -= 1;
        addLog(`${handNames[player]}は「阻害弾」により、このターンの通常ドローを行わない。`);
      }
      if (state.wholeRestActive[player]) {
        if (draws > 0) draws -= 1;
        addLog(`${handNames[player]}は「全休符」により、このターンの通常ドローを行わない。`);
      }
      if ((state.pendingDirectiveBonusDraw[player] || 0) > 0) {
        draws += state.pendingDirectiveBonusDraw[player];
        addLog(`${handNames[player]}は達成した「指令：再編成」により追加で${state.pendingDirectiveBonusDraw[player]}枚引く。`);
        state.pendingDirectiveBonusDraw[player] = 0;
      }
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

      if(state.activeDrawLock[player]){
        draws=0;
        addLog(`${handNames[player]}は「リタルダント」により、このターン中カードを引けない。`);
      }
      for (let i = 0; i < draws; i++) drawCard(player);

      await resolveAdvanceNotice(player);
      if(state.furiosoSkipActive[player]){
        state.furiosoSkipActive[player]=false;
        addLog(`${handNames[player]}は「Furioso」の反動により、このターン行動不能。`);
        render();
        await showTurnRestrictionPopup({ targetPlayer: player, restrictionType: "furioso" });
        await commitFriendTurnStartBeforeImmediateEnd(player,options);
        await endTurn("start-turn restriction");
        return;
      }
      if ((state.judgmentPrisonTurns?.[player] || 0) > 0) {
        addLog(`${handNames[player]}は「懲役」により、このターンはカードを使用できない。残り${state.judgmentPrisonTurns[player]}回。`);
        setMessage(`${handNames[player]}は「懲役」により、このターンはカードを使用できません。`);
        render();
      }

      if (state.activeIntemperanceCardLock[player]) {
        const lockMessage = getCardUseLockMessage(player);
        addLog(lockMessage);
        setMessage(lockMessage);
        render();
      }

      if (chargeStunDueThisTurn) {
        const recoilSource = chargeStunSourceDueThisTurn;

        addLog(`${handNames[player]}は「${recoilSource}」の反動により、このターンは行動不能。`);
        setMessage(`${handNames[player]}は「${recoilSource}」の反動で行動不能です。`);
        render();

        if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
          emitFriendFx("chargeRecoil", {
            playerSide: friendSideForLocalPlayer(player),
            source: recoilSource
          }).catch(error => console.error("PVP charge recoil fx failed", error));
        }

        await showChargeRecoilPopup(player, recoilSource, 1250);

        if (
          state.battleMode === "friend" &&
          player === "human" &&
          !state.friendApplyingRemoteState
        ) {
          await publishFriendStateNow();
        }

        await delay(250);
        await commitFriendTurnStartBeforeImmediateEnd(player,options);
        await endTurn("charge recoil");
        return;
      }
      if (state.pendingTerminalEnd[player]) {
        state.pendingTerminalEnd[player] = false;
        await commitFriendTurnStartBeforeImmediateEnd(player,options);
        await endTurn("start-turn terminal");
        return;
      }
      if (state.mode !== "attack") {
        render();
        if(state.battleMode==="friend"&&player==="human"&&options.friendTurnKey)await commitFriendTurnStartApplied(options);
        return;
      }

      if(await maybeAutoEndTurnForNoActions(player,options)){
        return;
      }

      if (player === "human") {
        setMessage(state.activeIntemperanceCardLock.human
          ? getCardUseLockMessage("human")
          : state.noSplit.human
            ? "あなたの番です。固定の効果で、このターンは分けるを選べません。"
          : accelerationTriggered
            ? `過過加速中です。このターンは${draws}枚ドローしました。`
            : noDrawTriggered
              ? "過加速の反動で、このターン開始時のドローはありません。"
              : "あなたの番です。カードを使うか罠を伏せてから、攻撃か分けるを選べます。");
      } else {
        const cpuName=getPlayerDisplayName("cpu");
        setMessage(state.activeIntemperanceCardLock.cpu ? getCardUseLockMessage("cpu") : state.noSplit.cpu ? `${cpuName}の番です。固定の効果で分けられません。` : accelerationTriggered ? `${cpuName}は過過加速中です。このターン${draws}枚ドローしました。` : noDrawTriggered ? `${cpuName}は過加速の反動でドローできません。` : `${cpuName}の番です。`);
      }

      render();
      if(state.battleMode==="friend"&&player==="human"&&options.friendTurnKey){
        await commitFriendTurnStartApplied(options);
      }
      if(state.battleMode==="friend"&&player==="human"&&!state.friendApplyingRemoteState&&(!options.friendTurnToken||state.friendTurnStartAppliedSerial>=state.friendTurnSerial)){
        await forcePublishFriendStateNow("turn start");
      }
    }

    function render() {
      refreshPlayerDisplayNames();
      const romanStatus=document.getElementById("romanPreparationStatus"),romanCounts=document.getElementById("romanPreparationCounts");
      if(romanStatus){const active=isRomanPreparation();romanStatus.hidden=!active;if(active&&romanCounts)romanCounts.textContent=`あなた：残り${romanRemainingPreparationTurns("human")}ターン / 相手：残り${romanRemainingPreparationTurns("cpu")}ターン`;}
      ensureThemeAttachments("human"); ensureThemeAttachments("cpu");
      ensureOnlineStateMaps();
      scheduleFriendStatePublish();
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

          if (!state.gameOver && !state.animating && !state.startingRouletteActive && state.turn === "human") {
            if (state.mode === "boardHandSelection" && pendingBoardHandSelection?.candidates.some(item => item.owner === player && item.hand === hand)) {
              card.classList.add("trap-target");
            }
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
            if (state.mode === "andante" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "chargeTargetOwn" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "chargeTargetOpponent" && player === "cpu" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "dimensionalSlashSacrifice" && player === "human" && value > 0) {
              card.classList.add("dimensional-sacrifice-target");
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
        state.gameOver ? "" : state.startingRouletteActive ? "先攻決定中" : state.turn === "human" ? "あなたのターン" : `${getPlayerDisplayName("cpu")}のターン`;
      elements.cpuState.textContent =
        state.gameOver ? "" : state.startingRouletteActive ? "先攻決定中" : state.turn === "cpu" ? `${getPlayerDisplayName("cpu")}のターン` : "待機中";

      if (elements.battleRestartBtn) {
        elements.battleRestartBtn.classList.toggle("screen-hidden", state.battleMode === "friend");
      }
      const friendBattle=state.battleMode==="friend";
      elements.battleBackMenuBtn?.classList.toggle("screen-hidden",friendBattle);
      elements.drawBtn?.classList.toggle("screen-hidden",friendBattle);
      elements.resetBtn?.classList.toggle("screen-hidden",friendBattle);
      elements.friendSurrenderBtn?.classList.toggle("screen-hidden",!(friendBattle&&state.friendMatchStarted&&!state.gameOver));
      if(elements.friendSurrenderBtn)elements.friendSurrenderBtn.disabled=state.friendSurrenderBusy||state.gameOver;
      if (elements.battleResultReopenBtn) {
        elements.battleResultReopenBtn.classList.toggle("screen-hidden", !(state.battleMode === "friend" && state.gameOver && state.matchResult));
      }
      const selectionLock = ["boardHandSelection", "handCardSelection", "numberAllocation"].includes(state.mode);
      const interactionLock=isFriendInteractionBlocking();
      const lock = state.animating || state.startingRouletteActive || state.turn !== "human" || state.gameOver || selectionLock || interactionLock;
      const setupActive = state.turn === "human" && state.temp.human.setupMode && !state.gameOver;
      elements.attackBtn.disabled = lock || setupActive || !canUseNormalAttackAction("human");
      elements.splitBtn.disabled = lock || setupActive || state.noSplit.human || state.berserkerTurns.human > 0 || !canHumanSplit();
      elements.drawBtn.disabled = friendBattle || lock || setupActive;
      elements.cancelBtn.disabled = lock && !setupActive;
      elements.cancelBtn.textContent = setupActive ? "仕込み終了" : "解除";
      elements.confirmSplitBtn.disabled = lock || setupActive;

      elements.humanDeckCount.textContent = state.decks.human.length;
      elements.cpuDeckCount.textContent = state.decks.cpu.length;
      elements.handInfo.textContent = `${getPlayerDisplayName("human",{includeYou:true})} ${state.hands.human.length}枚 / ${getPlayerDisplayName("cpu")} ${state.hands.cpu.length}枚`;
      renderHumanCards();
      renderLastAction();

      elements.log.innerHTML = state.log.map(item => `<div>${escapeHtml(item)}</div>`).join("");
      updateSplitOptions();
    }

    function makeTrapInstance(cardId, owner = null) {
      const instance = {
        id: `trap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        cardId
      };
      if (cardId === "weaknessCurse") instance.waitTurns = 1;
      if (cardId === "duelSurge") {
        instance.level = 0;
        instance.duelTargetOwner = null;
        instance.duelTargetHand = null;
      }
      if (cardId === "harpoon") {
        instance.owner = owner;
        instance.vibration = 0;
        instance.lastDrawTurnKey = "";
      }
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

    function harpoonTurnKey() { return `${state.turnNumber}:${state.turn}:${state.personalTurnCount?.[state.turn] || 0}`; }
    function allHarpoons() {
      const found=[];
      for(const player of ["human","cpu"]) for(const hand of ["L","R"]) state.traps[player][hand].forEach((slot,index)=>{
        if(trapCardId(slot)==="harpoon") found.push({player,hand,index,slot});
      });
      return found;
    }
    function findOwnedHarpoon(owner){ return allHarpoons().find(x=>x.slot?.owner===owner)||null; }
    function findOwnedHarpoonAt(owner,player,hand){ return allHarpoons().find(x=>x.player===player&&x.hand===hand&&x.slot?.owner===owner)||null; }
    function attachHarpoon(owner,targetPlayer,targetHand,{replaceRandom=false}={}){
      if(findOwnedHarpoon(owner)||state[targetPlayer][targetHand]<=0) return false;
      const slots=state.traps[targetPlayer][targetHand];
      if(slots.length>=2){
        if(!replaceRandom)return false;
        const removable=slots.map((slot,index)=>({slot,index,cardId:trapCardId(slot)})).filter(item=>isExternallyRemovableAttachment(item.cardId));
        if(!removable.length){addLog("「銛投擲」は外部効果で除去できる設置カードがなく、銛付与が不発。");return false;}
        const picked=removable[Math.floor(Math.random()*removable.length)],removed=slots.splice(picked.index,1)[0],id=trapCardId(removed);
        if(id!=="harpoon") state.discard[targetPlayer].push(id);
        addLog(`「銛投擲」により${handNames[targetPlayer]}の${handNames[targetHand]}の設置カード1枚が捨てられた。`);
      }
      slots.push(makeTrapInstance("harpoon",owner));
      addLog(`${handNames[owner]}の「銛」が${handNames[targetPlayer]}の${handNames[targetHand]}についた。`);
      render(); return true;
    }
    async function chooseAndAttachHarpoon(owner,replaceRandom){
      if(findOwnedHarpoon(owner)){addLog(`${handNames[owner]}はすでに自分の銛を場に出しているため、新たな銛付与だけ不発。`);return false;}
      const target=otherPlayer(owner);
      const choice=await beginBoardHandSelection(owner,{owners:[target],allowZero:false,message:"銛をつける相手の手を選んでください。",cpuPick:cs=>cs[Math.floor(Math.random()*cs.length)]});
      if(choice) attachHarpoon(owner,choice.owner,choice.hand,{replaceRandom});
    }
    function reuseHarpoonCard(player){
      const candidates=state.discard[player].map((id,index)=>({id,index})).filter(x=>CARD_LIBRARY[x.id]?.harpoonAttach&&x.id!=="harpoon");
      if(!candidates.length){addLog("「銛の再利用」は対象がなく不発。");return false;}
      const picked=candidates[Math.floor(Math.random()*candidates.length)];
      state.discard[player].splice(picked.index,1);state.decks[player].push(picked.id);shuffle(state.decks[player]);
      addLog(`${handNames[player]}は「${CARD_LIBRARY[picked.id].name}」を山札へ戻してシャッフルした。`);return true;
    }
    async function showHarpoonRecoveryFx(player,hand,vibration){
      const handElement=document.getElementById(`${player}${hand}`);
      if(!handElement)return;
      const slots=[...handElement.querySelectorAll(".harpoon-slot")];
      const value=document.createElement("div");
      value.className="harpoon-recovery-value";
      value.textContent=`銛-振動:${Math.max(0,Number(vibration)||0)}`;
      handElement.appendChild(value);
      handElement.classList.add("harpoon-recovering");
      slots.forEach(slot=>slot.classList.add("harpoon-recovering"));
      await delay(300);
      handElement.classList.add("harpoon-recovery-burst");
      await delay(110);
      handElement.classList.remove("harpoon-recovering","harpoon-recovery-burst");
      slots.forEach(slot=>slot.classList.remove("harpoon-recovering"));
      value.remove();
    }
    async function recoverHarpoon(owner,{sourceLabel="銛回収",zeroAtSeven=false}={}){
      const info=findOwnedHarpoon(owner); if(!info){addLog(`「${sourceLabel}」は銛がなく不発。`);return {recovered:false,zeroed:false};}
      const vibration=Math.max(0,Number(info.slot.vibration)||0), before=state[info.player][info.hand];
      if(state.battleMode==="friend"&&!state.friendApplyingRemoteState){
        await emitFriendFx("harpoonRecover",{targetSide:friendSideForLocalPlayer(info.player),hand:info.hand,vibration,sourceLabel});
      }
      await showHarpoonRecoveryFx(info.player,info.hand,vibration);
      state.traps[info.player][info.hand].splice(info.index,1);
      let zeroed=false;
      if(vibration>0&&before>0){
        await addFingersWithCalculation(info.player,info.hand,vibration,sourceLabel,false,{sourcePlayer:owner,zeroAtSeven});
        zeroed=before>0&&state[info.player][info.hand]===0;
      }
      addLog(`${handNames[owner]}は${handNames[info.player]}の${handNames[info.hand]}から「銛-振動:${vibration}」を回収した。`);
      render(); return {recovered:true,zeroed,targetPlayer:info.player,targetHand:info.hand};
    }
    async function resolveHarpoonAttackHit(attacker,attackHand,defender,targetHand,{resonance=false,isInternal=false}={}){
      const hits=allHarpoons().filter(x=>x.player===defender&&x.hand===targetHand);
      for(const info of hits){
        info.slot.vibration=Math.max(0,Number(info.slot.vibration)||0)+1;
        if(info.slot.lastDrawTurnKey!==harpoonTurnKey()){info.slot.lastDrawTurnKey=harpoonTurnKey();drawCard(attacker);addLog(`${handNames[attacker]}は銛への初回命中で1枚引いた。`);}
      }
      const own=findOwnedHarpoonAt(attacker,defender,targetHand);
      if(state.temp[attacker].harpoonResonance){state.temp[attacker].harpoonResonance=false;if(own&&resonance){own.slot.vibration+=3;addLog(`「銛共鳴」により銛-振動+3。`);}}
      if(state.temp[attacker].doubleCarveHarpoon){
        state.temp[attacker].doubleCarveHarpoon=false;
        if(own&&state[attacker][attackHand]>0&&state[defender][targetHand]>0) await resolveInternalNormalAttack({attackerPlayer:attacker,attackerHand:attackHand,targetPlayer:defender,targetHand,sourceCardId:"doubleCarveHarpoon"});
      }
      render();
    }
    function resolveHarpoonBeforeAttack(attacker,defender,targetHand,{isInternal=false}={}){
      if(!state.temp[attacker]?.harpoonEmbed)return false;
      state.temp[attacker].harpoonEmbed=false;
      return attachHarpoon(attacker,defender,targetHand);
    }

    const MAGICAL_EVOLUTION_MAP = {
      wornHope: "togetherWithFriends", hysteria: "withLove",
      fadedCreed: "knightCreed", intemperance: "goldMadness",
      betrayedHeart: "friendship", emptyHeart: "fullHeart",
      frenzy: "rationalPower", selfRighteousness: "justiceForEveryone",
      sacrificePower: "powerOfEveryone"
    };
    const PERFORMANCE_LV5_EVOLUTION_MAP = Object.freeze({
      fermata: "ritardando",
      canon: "arpeggio",
      quarterRest: "wholeRest",
      agitato: "furioso",
      doloroso: "appassionato",
      lacrimosa: "requiem",
      portamento: "dissonance",
      presto: "sforzando"
    });
    const PERFORMANCE_MAX_LEVEL = 6;
    const PERFORMANCE_EVOLUTION_LEVEL = 5;
    const PERFORMANCE_ROMAN_LEVELS = Object.freeze(["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ"]);
    function transformMagicalEvolutionCards(player) {
      const f=id=>MAGICAL_EVOLUTION_MAP[id]||id;
      state.hands[player]=state.hands[player].map(f);
      state.decks[player]=state.decks[player].map(f);
      state.discard[player]=state.discard[player].map(f);
    }
    function countOwnBlessings(player){let n=0;for(const h of ["L","R"])n+=state.traps[player][h].filter(s=>CARD_LIBRARY[trapCardId(s)]?.blessing).length;return n;}
    function randomIndex(n){return n>0?Math.floor(Math.random()*n):-1;}
    const MAGICAL_CHANT_LINES = [
      "正義よりも蒼き者よ、愛よりも紅き者よ",
      "運命の中に埋もれしそなたの名に懸けて　我、ここで光に誓う",
      "我が前に立ちはだかる憎らしき存在たちへ　我とそなたの力を合わせ、偉大なる愛の力を示さんことを"
    ];

    function hasCompletedMagicalBlessing(player) {
      return ["magicalLove","magicalJustice","magicalHappiness","magicalCourage"].some(id =>
        ["L","R"].some(hand => hasAttachment(player, hand, id))
      );
    }

    function effectiveCardIdForPlayer(player, cardId) {
      if (cardId === "magicalChant" && (state.magicalChantCompleted?.[player] || hasCompletedMagicalBlessing(player))) return "arcanaSlave";
      if ((state.performanceLevel?.[player] || 0) >= PERFORMANCE_EVOLUTION_LEVEL) {
        return PERFORMANCE_LV5_EVOLUTION_MAP[cardId] || cardId;
      }
      return cardId;
    }

    function isProtectedHandCard(cardId) {
      return isProtectedChargeCard(cardId) || !!CARD_LIBRARY[cardId]?.protectedSpecial;
    }
    function isExternallyDiscardableHandCard(cardId) {
      return !!cardId && CARD_LIBRARY[cardId]?.discardable !== false && !isProtectedHandCard(cardId) && !isRomanTemporarilyProtectedHandCard(cardId);
    }
    function isCountedHandCard(cardId){return !!cardId&&CARD_LIBRARY[cardId]?.countsAsHandCard!==false;}
    function getCountedHandCards(player){return state.hands[player].map((cardId,index)=>({cardId,index})).filter(x=>isCountedHandCard(x.cardId));}
    function countHandCards(player){return getCountedHandCards(player).length;}
    function ensureHandCardInstances(player){
      if(!state.handCardInstances)state.handCardInstances={human:[],cpu:[]};
      const ids=state.handCardInstances[player]||[];
      while(ids.length<state.hands[player].length)ids.push(`ci-${++state.cardInstanceSequence}`);
      if(ids.length>state.hands[player].length)ids.length=state.hands[player].length;
      state.handCardInstances[player]=ids;return ids;
    }
    function handCardInstanceId(player,index){return ensureHandCardInstances(player)[index]||null;}
    function isCardInstanceLocked(player,index){const id=handCardInstanceId(player,index);return !!id&&(state.cardLocks?.[player]||[]).some(lock=>lock.instanceId===id&&lock.turnsRemaining>0);}
    function canDiscardHandCard(player,index,reason="cardEffect"){
      const cardId=state.hands[player]?.[index];if(!isExternallyDiscardableHandCard(cardId))return false;
      return reason==="fatigue"||!isCardInstanceLocked(player,index);
    }
    function getDiscardCandidates(player,reason="cardEffect"){return state.hands[player].map((cardId,index)=>({cardId,index,instanceId:handCardInstanceId(player,index)})).filter(x=>canDiscardHandCard(player,x.index,reason));}
    function getTradeEligibleCards(player){return getDiscardCandidates(player,"trade");}
    function removeCardWithoutDiscard(player,index,reason="消滅"){
      if(index<0||index>=state.hands[player].length)return null;ensureHandCardInstances(player);const [id]=state.hands[player].splice(index,1);state.handCardInstances[player].splice(index,1);if(id)addLog(`${handNames[player]}の「${CARD_LIBRARY[id]?.name||id}」が${reason}した。`);return id;
    }
    function vanishTurnEndCards(player){for(let i=state.hands[player].length-1;i>=0;i--)if(CARD_LIBRARY[state.hands[player][i]]?.vanishAtTurnEnd)removeCardWithoutDiscard(player,i,"ターン終了時に消滅");}
    function v166HandTotal(player){return Number(state[player].L||0)+Number(state[player].R||0);}
    function v166NormalizeForHand(value,player,hand){if(value>=5&&hasAttachment(player,hand,"sniperBlessing"))return 0;return normalize(Math.max(0,value),player,hand);}
    function v166ApplyFingerValue(targetPlayer,hand,value,sourcePlayer,label){if(state.nobleGasProtected?.[targetPlayer]&&sourcePlayer&&sourcePlayer!==targetPlayer){addLog(`${label}は「貴ガス」に防がれた。`);return state[targetPlayer][hand];}const before=state[targetPlayer][hand];state[targetPlayer][hand]=v166NormalizeForHand(value,targetPlayer,hand);if(before!==state[targetPlayer][hand])addLog(`${label}：${handNames[targetPlayer]}の${handNames[hand]} ${before}→${state[targetPlayer][hand]}。`);clearBrokenTraps(targetPlayer);return state[targetPlayer][hand];}
    async function useSupportFire(player){
      const o=otherPlayer(player),picked=await beginBoardHandSelection(player,{owners:[o],minimum:1,message:"「援護射撃」：1本加える相手の手を選んでください。",cpuPick:candidates=>[...candidates].sort((a,b)=>b.value-a.value)[0]});
      if(picked)v166ApplyFingerValue(o,picked.hand,state[o][picked.hand]+1,player,"援護射撃");
    }
    async function useBalancedScales(player){const plus=player==="cpu"?true:await showGameConfirmation({title:"釣り合った天秤",message:"全ての手へ+1を適用しますか？（キャンセルで-1）",confirmLabel:"+1",cancelLabel:"-1"}),delta=plus?1:-1,o=otherPlayer(player);for(const owner of [player,o])for(const hand of ["L","R"])v166ApplyFingerValue(owner,hand,state[owner][hand]+delta,player,"釣り合った天秤");}
    async function useMemoryCard(player){if((state.copiedEffectDepth||0)>=2){addLog("「思い出」は記憶の連鎖が深くなり不発。");return;}const candidates=state.discard[player].filter(id=>CARD_LIBRARY[id]&&typeof CARD_LIBRARY[id].effect==="function"&&!isEffectCopyExcluded(id,"brawl"));if(!candidates.length)return;const id=candidates[Math.floor(Math.random()*candidates.length)];state.copiedEffectDepth++;try{await activateCopiedCardEffect(player,id,"思い出");}finally{state.copiedEffectDepth--;}}
    async function useCardLock(player){
      ensureHandCardInstances(player);let picks;
      if(player==="human"){
        const indexes=await beginHandCardSelection({min:2,max:2,filter:(id,index)=>canDiscardHandCard(player,index,"cardEffect"),message:"「カードロック」：保護するカードを2枚選んでください。"});
        picks=indexes.map(index=>({index,cardId:state.hands[player][index],instanceId:handCardInstanceId(player,index)}));
      }else picks=getDiscardCandidates(player,"cardEffect").slice(0,2);
      state.cardLocks[player]=[...(state.cardLocks[player]||[]),...picks.map(x=>({instanceId:x.instanceId,cardId:x.cardId,turnsRemaining:2}))];
    }
    function replaceHandAttachments(player){[state.traps[player].L,state.traps[player].R]=[state.traps[player].R,state.traps[player].L];addLog(`${handNames[player]}は左右の設置物を入れ替えた。`);}
    async function useForceCard(player){
      const o=otherPlayer(player);let pick=null;
      if(state.battleMode==="friend"&&player==="human"){
        const actionId=makeFriendInterruptId();await createSecureFriendInteraction({actionId,type:"forceCard"});
        await forcePublishFriendStateNow("強制の選択待ち開始");
        const response=await requestRemoteFriendDecision("forceCard",{matchId:state.friendMatchId,turnSerial:Number(state.friendTurnSerial||0)},{id:actionId}),secure=await readSecureFriendInteraction(actionId);
        if(response?.matchId!==state.friendMatchId||response?.actionId!==actionId||secure?.status!=="responded"||secure?.targetInstanceId!==response.instanceId)return;
        const index=state.handCardInstances[o].indexOf(secure.targetInstanceId);if(index<0||!isCountedHandCard(state.hands[o][index]))return;
        state.forcedCard[o]={instanceId:secure.targetInstanceId,cardId:state.hands[o][index],pending:true,active:false};
        try{await publishFriendInteractionFinalState("強制の選択確定",actionId);}catch(error){setMessage("強制の同期確定を待っています。再接続後も自動的に再開します。");console.error("PVP force finalize failed",error);}
        return;
      }
      if(o==="human"){
        const indexes=await beginHandCardSelection({min:1,max:1,filter:id=>isCountedHandCard(id),message:"「強制」：次の自分のターンに使用するカードを1枚選んでください。"});
        if(indexes.length)pick={index:indexes[0],cardId:state.hands[o][indexes[0]]};
      }else pick=getCountedHandCards(o)[0];
      if(!pick)return;state.forcedCard[o]={instanceId:handCardInstanceId(o,pick.index),cardId:pick.cardId,pending:true,active:false};
    }
    function closePeekResult() {
      elements.peekResultModal.classList.remove("show");
      elements.peekResultModal.setAttribute("aria-hidden", "true");
    }

    function showPeekResult(cards) {
      return new Promise(resolve => {
        elements.peekResultText.textContent = cards.length
          ? "相手の手札から以下のカードが見えました。"
          : "見ることができるカードはありません。";
        elements.peekResultList.innerHTML = cards.map(({ cardId }) => {
          const card = CARD_LIBRARY[cardId];
          return `<div class="trap-choice-card peek-result-card">
            <div class="peek-result-card-head"><strong>${escapeHtml(card?.name || cardId)}</strong><span>コスト ${Number(card?.cost) || 0}</span></div>
            <div class="card-label-row"><span class="card-type">${escapeHtml(card?.type || "その他")}</span></div>
            <div class="peek-result-card-text">${escapeHtml(card?.text || "")}</div>
          </div>`;
        }).join("");
        elements.peekResultConfirmBtn.onclick = () => {
          closePeekResult();
          elements.peekResultConfirmBtn.onclick = null;
          resolve();
        };
        elements.peekResultModal.classList.add("show");
        elements.peekResultModal.setAttribute("aria-hidden", "false");
        elements.peekResultConfirmBtn.focus();
      });
    }

    async function usePeek(player) {
      const cards = shuffled(getCountedHandCards(otherPlayer(player))).slice(0, 3);
      // CPU/remote opponentの取得内容は共有state・ログ・人間側UIへ出さない。
      if (player !== "human") return cards;
      await showPeekResult(cards);
      return cards;
    }
    function v166ExchangePairs(player){const o=otherPlayer(player),pairs=[];for(const a of ["L","R"])for(const b of ["L","R"])if(state[player][a]>0&&state[o][b]>0&&state[player][a]!==state[o][b])pairs.push([a,b]);return pairs;}
    function hasV166ExchangePair(player){return v166ExchangePairs(player).length>0;}
    async function useExchangeHands(player){
      const o=otherPlayer(player);let pair;
      if(player==="human"){
        const own=await beginBoardHandSelection(player,{owners:[player],minimum:1,message:"「交換」：交換する自分の手を選んでください。"});if(!own)return;
        const opponent=await beginBoardHandSelection(player,{owners:[o],minimum:1,candidateFilter:item=>item.value!==own.value,message:"「交換」：本数の異なる相手の手を選んでください。"});if(!opponent)return;
        pair=[own.hand,opponent.hand];
      }else pair=v166ExchangePairs(player)[0];
      if(!pair)return;const [a,b]=pair,x=state[player][a],y=state[o][b];v166ApplyFingerValue(player,a,y,player,"交換");v166ApplyFingerValue(o,b,x,player,"交換");
    }
    async function chooseTradeCard(player){
      if(player!=="human")return getTradeEligibleCards(player)[0]||null;
      const indexes=await beginHandCardSelection({min:1,max:1,filter:(id,index)=>canDiscardHandCard(player,index,"trade"),message:"「貿易」：相手へ渡すカードを1枚選んでください。"});
      return indexes.length?{index:indexes[0],cardId:state.hands[player][indexes[0]],instanceId:handCardInstanceId(player,indexes[0])}:null;
    }
    async function useTrade(player){
      if(state.battleMode==="friend"&&player==="human"){
        const a=await chooseTradeCard(player);if(!a)return;
        const actionId=makeFriendInterruptId(),nonce=randomInteractionNonce(),sourceCommit=await makeTradeCommit({matchId:state.friendMatchId,actionId,role:state.friendRole,instanceId:a.instanceId,nonce});
        await savePrivateTradeChoice({actionId,instanceId:a.instanceId,nonce,commit:sourceCommit});
        await createSecureFriendInteraction({actionId,type:"trade",sourceCommit});
        await forcePublishFriendStateNow("貿易の選択待ち開始");
        const response=await requestRemoteFriendDecision("trade",{matchId:state.friendMatchId,actionId,turnSerial:Number(state.friendTurnSerial||0),sourceCommit},{id:actionId});
        await resolveOnlineTradeResponse(actionId,response);return;
      }
      const o=otherPlayer(player),a=await chooseTradeCard(player),b=await chooseTradeCard(o);if(!a||!b)return;
      ensureHandCardInstances(player);ensureHandCardInstances(o);const ai=state.handCardInstances[player].indexOf(a.instanceId),bi=state.handCardInstances[o].indexOf(b.instanceId);if(ai<0||bi<0||!canDiscardHandCard(player,ai,"trade")||!canDiscardHandCard(o,bi,"trade"))return;
      const aid=state.hands[player][ai],bid=state.hands[o][bi],ainst=state.handCardInstances[player][ai],binst=state.handCardInstances[o][bi];state.hands[player][ai]=bid;state.hands[o][bi]=aid;state.handCardInstances[player][ai]=binst;state.handCardInstances[o][bi]=ainst;addLog("「貿易」で双方が選んだカードを同時に交換した。");
    }
    async function useUntidy(player){
      const o=otherPlayer(player),picked=await beginBoardHandSelection(player,{owners:[o],minimum:2,message:"「整わない」：1本減らす相手の手を選んでください。",cpuPick:candidates=>[...candidates].sort((a,b)=>b.value-a.value)[0]});if(!picked)return;
      v166ApplyFingerValue(o,picked.hand,state[o][picked.hand]-1,player,"整わない");const own=["L","R"].filter(h=>state[player][h]>0);if(own.length){const h=own[Math.floor(Math.random()*own.length)];v166ApplyFingerValue(player,h,state[player][h]+1,player,"整わない");}
    }
    function isProtectedAttachment(cardId) {
      return !!CARD_LIBRARY[cardId]?.themeBlessing;
    }
    function isExternallyRemovableAttachment(cardId) {
      return !!cardId && !isProtectedAttachment(cardId);
    }

    function themeCardId(player) {
      return state.selectedTheme?.[player] === "serenade" ? "serenadeTheme" : state.selectedTheme?.[player] === "rondo" ? "rondoTheme" : null;
    }

    function ensureThemeAttachments(player) {
      const id = themeCardId(player);
      state.discard[player]=state.discard[player].filter(cardId=>!CARD_LIBRARY[cardId]?.themeBlessing);
      for (const hand of ["L", "R"]) {
        state.traps[player][hand] = state.traps[player][hand].filter(slot => !CARD_LIBRARY[trapCardId(slot)]?.themeBlessing || trapCardId(slot) === id);
        if (id && state[player][hand] > 0 && !state.traps[player][hand].some(slot => trapCardId(slot) === id)) state.traps[player][hand].push(id);
      }
    }

    function getPerformanceLevel(player) { return Math.max(0, Math.min(PERFORMANCE_MAX_LEVEL, Number(state.performanceLevel?.[player] || 0))); }
    function performanceLevelLabel(level) { return PERFORMANCE_ROMAN_LEVELS[Math.max(0, Math.min(PERFORMANCE_MAX_LEVEL, Number(level) || 0))] || ""; }
    function setPerformanceLevel(player, level, reason = "") {
      const next = Math.max(0, Math.min(PERFORMANCE_MAX_LEVEL, Number(level) || 0));
      state.performanceLevel[player] = next;
      state.hands[player] = state.hands[player].filter(id => id !== "performance");
      if (next > 0) state.hands[player].push("performance");
      if (reason) addLog(`${handNames[player]}の「演舞」は${next ? `演舞${performanceLevelLabel(next)}` : "消滅"}（${reason}）。`);
      render();
      return next;
    }
    function changePerformanceLevel(player, delta, reason) {
      const before = getPerformanceLevel(player);
      return setPerformanceLevel(player, before + delta, reason);
    }

    function transformMagicalChantCards(player) {
      for (const zone of [state.hands[player], state.decks[player], state.discard[player]]) {
        for (let i = 0; i < zone.length; i++) if (zone[i] === "magicalChant") zone[i] = "arcanaSlave";
      }
    }

    function returnOneCardFromDiscardToDeck(player, cardId) {
      const index = state.discard[player].lastIndexOf(cardId);
      if (index < 0) return false;
      state.discard[player].splice(index, 1);
      state.decks[player].push(cardId);
      shuffle(state.decks[player]);
      return true;
    }

    function useEncore(player) {
      if (!returnOneCardFromDiscardToDeck(player, "finale")) addLog(`${handNames[player]}の「アンコール」は捨て札にフィナーレがなく不発。`);
      else addLog(`${handNames[player]}は「アンコール」でフィナーレを山札へ戻してシャッフルした。`);
    }

    async function useDaCapo(player) {
      const indexes = state.hands[player].map((id,index)=>({id,index})).filter(x=>isExternallyDiscardableHandCard(x.id)).map(x=>x.index);
      const directCount = indexes.length;
      await discardFixedHandCardsByEffect(player,indexes,"「ダ・カーポ」");
      for(let i=0;i<directCount;i++) drawCard(player);
      state[player].L=1; state[player].R=1; ensureThemeAttachments(player);
      const handDaCapo=state.hands[player].map((id,index)=>({id,index})).filter(x=>x.id==="daCapo").map(x=>x.index);
      await discardFixedHandCardsByEffect(player,handDaCapo,"「ダ・カーポ」");
      for(let i=state.decks[player].length-1;i>=0;i--) if(state.decks[player][i]==="daCapo") state.discard[player].push(state.decks[player].splice(i,1)[0]);
      state.pendingTerminalEnd[player]=true; render();
    }

    async function chooseTheme(player) {
      let theme;
      if(player==="human") return chooseThemeV153(player);
      else {
        const rondos=state.hands[player].filter(id=>CARD_LIBRARY[id]?.rondo).length+state.decks[player].filter(id=>CARD_LIBRARY[id]?.rondo).length;
        theme=rondos>=3?"rondo":"serenade";
      }
      state.selectedTheme[player]=theme; ensureThemeAttachments(player);
      state.temp[player].cardExtraUses=Number(state.temp[player].cardExtraUses||0)+1;
      addLog(`${handNames[player]}は「題目：${theme==="rondo"?"ロンド":"セレナーデ"}」を選択した。`); render();
    }

    async function useFermata(player) {
      drawCard(player);
      const extra=player==="human"?await showGameConfirmation({title:"フェルマータ",message:"もう1枚引き、ターンを終了しますか？",confirmLabel:"もう1枚引く",cancelLabel:"このまま続ける"}):state.hands[player].length<4;
      if(extra){drawCard(player);state.pendingTerminalEnd[player]=true;}
    }
    function useRitardando(player){const o=otherPlayer(player);for(const h of ["L","R"]){const before=state[o][h];if(before<=0)continue;state[o][h]=Math.max(0,before-1);if(state[o][h]===0)markDirectiveOpponentZero(player,o,before);}clearBrokenTraps(o);state.pendingDrawLock[o]=true;render();}
    function useQuarterRest(player){const o=otherPlayer(player);state.quarterRestPending[o]=true;state.quarterRestPending[player]=true;}
    function useWholeRest(player){const o=otherPlayer(player);state.wholeRestPending[o]=true;}

    async function chooseLivingHand(player, owner, promptText) {
      const choices=["L","R"].filter(hand=>state[owner][hand]>0);
      if(!choices.length)return null;
      if(player!=="human")return choices.sort((a,b)=>state[owner][a]-state[owner][b])[0];
      if(choices.length===1)return choices[0];
      const selected=await beginBoardHandSelection(player,{owners:[owner],message:promptText,cpuPick:items=>items[0]});
      return selected?.hand||null;
    }

    async function useAgitato(player){
      await discardRandomCards(player,1,"「Agitato」");
      await discardRandomCards(otherPlayer(player),1,"「Agitato」");
      render();
    }

    function useFurioso(player){
      const rondoCount=state.hands[player].filter(raw=>CARD_LIBRARY[effectiveCardIdForPlayer(player,raw)]?.rondo).length;
      const temp=state.temp[player];
      temp.attackLimit=Math.max(Number(temp.attackLimit??1),rondoCount);
      if(rondoCount===0&&Number(temp.attacksUsed||0)===0)temp.attackLimit=0;
      temp.multiAttackSource="Furioso";
      changePerformanceLevel(player,-5,"Furioso");
      state.furiosoSkipPending[player]=true;
      addLog(`${handNames[player]}は「Furioso」により通常攻撃を最大${rondoCount}回行える。次の自分のターンは行動不能。`);
      render();
    }

    function useDoloroso(player){
      return useDolorosoV153(player);
      const hand=chooseLivingHand(player,player,"Dolorosoで0にする自分の手を選んでください。");
      if(!hand)return false;
      state[player][hand]=0; clearBrokenTraps(player);
      for(let i=0;i<3;i++)drawCard(player);
      render(); return true;
    }

    function useAppassionato(player){
      return useAppassionatoV153(player);
      if(state.temp[player].appassionatoUsedThisTurn)return false;
      const hand=chooseLivingHand(player,player,"Appassionatoで0にする自分の手を選んでください。");
      if(!hand)return false;
      state.temp[player].appassionatoUsedThisTurn=true;
      state[player][hand]=0; clearBrokenTraps(player);
      state.temp[player].cardExtraUses=Number(state.temp[player].cardExtraUses||0)+2;
      render(); return true;
    }

    function useLacrimosa(player){
      return useLacrimosaV153(player);
      const opponent=otherPlayer(player);
      if(!(state[player].L>0||state[player].R>0)||state[opponent].L<=0||state[opponent].R<=0)return false;
      const ownHand=chooseLivingHand(player,player,"Lacrimosaで0にする自分の手を選んでください。");
      if(!ownHand)return false;
      state[player][ownHand]=0; clearBrokenTraps(player);
      const target=chooseLivingHand(player,opponent,"Lacrimosaで0にする相手の手を選んでください。");
      if(target){state[opponent][target]=0;clearBrokenTraps(opponent);}
      render(); return !!target;
    }

    async function useRequiem(player){
      return useRequiemV153(player);
      const hand=chooseLivingHand(player,player,"Requiemで0にする自分の手を選んでください。");
      if(!hand){state.pendingTerminalEnd[player]=true;return false;}
      state[player][hand]=0; clearBrokenTraps(player);
      const opponent=otherPlayer(player);
      const fixedIndexes=state.hands[opponent].map((id,index)=>({id,index})).filter(item=>isExternallyDiscardableHandCard(item.id)).map(item=>item.index);
      await discardFixedHandCardsByEffect(opponent,fixedIndexes,"「Requiem」");
      state.pendingTerminalEnd[player]=true; render(); return true;
    }

    function useMorendo(player){
      for(const owner of [player,otherPlayer(player)]){
        const choices=["L","R"].filter(hand=>state[owner][hand]>0);
        if(choices.length)state[owner][choices[Math.floor(Math.random()*choices.length)]]=1;
        clearBrokenTraps(owner);
      }
      render();
    }

    async function useGrandioso(player){
      const targets=[];
      for(const owner of [player,otherPlayer(player)])for(const hand of ["L","R"])if(state[owner][hand]>0&&!isRomanOpponentTarget(player,owner))targets.push({owner,hand});
      const changes=targets.map(({owner,hand})=>{const before=state[owner][hand],amount=applyGuardBlessingReduction(owner,hand,2,"Grandioso"),total=before+amount;return{owner,hand,before,total,after:normalize(total,owner,hand)};});
      for(const change of changes){await animateCalculation(change.owner,change.hand,change.total,change.after);state[change.owner][change.hand]=change.after;}
      for(const owner of [player,otherPlayer(player)])clearBrokenTraps(owner);
      state.pendingTerminalEnd[player]=true; render();
    }

    function beginPortamento(player){
      const choices=["L","R"].filter(hand=>state[player][hand]>0);
      if(!choices.length)return false;
      if(player==="human"){
        state.pendingPortamento={player};state.mode="portamentoSource";
        setMessage("ポルタメント：1本増やす自分の手を選んでください。");render();return true;
      }
      return resolvePortamento(player,choices.sort((a,b)=>state[player][b]-state[player][a])[0]);
    }

    async function resolvePortamento(player,hand){
      if(!["L","R"].includes(hand)||state[player][hand]<=0)return false;
      await addFingersWithCalculation(player,hand,1,"ポルタメント");
      const other=otherHand(hand);
      if(state[player][other]>0)state[player][other]=Math.max(0,state[player][other]-1);
      clearBrokenTraps(player);state.pendingPortamento=null;state.mode="attack";render();return true;
    }

    function beginDissonance(player){
      const choices=["L","R"].filter(hand=>state[player][hand]>0);
      if(!choices.length)return false;
      if(player==="human"){
        state.pendingDissonance={player};state.mode="dissonanceSource";
        setMessage("ディソナンス：通常攻撃に使う自分の手を選んでください。");render();return true;
      }
      return resolveDissonance(player,choices.sort((a,b)=>state[player][b]-state[player][a])[0]);
    }

    async function resolveDissonance(player,attackHand){
      if(!["L","R"].includes(attackHand)||state[player][attackHand]<=0)return false;
      state.pendingDissonance=null;state.mode="attack";
      return await resolveInternalNormalAttack({attackerPlayer:player,attackerHand:attackHand,targetPlayer:player,targetHand:otherHand(attackHand),allowZeroTarget:true,sourceCardId:"dissonance"});
    }

    function usePresto(player){
      state.pendingPrestoAttack[player]=true;
      addLog(`${handNames[player]}の次の攻撃に「プレスト」が適用される。`);
      return true;
    }

    function beginSforzando(player){
      const candidates=[];
      for(const owner of [player,otherPlayer(player)])for(const hand of ["L","R"])if(state[owner][hand]>0)candidates.push({owner,hand});
      if(!candidates.length)return false;
      if(player==="human"){
        state.pendingSforzando={player};state.mode="sforzandoTarget";
        setMessage("スフォルツァント：攻撃増加量にする0ではない手を選んでください。");render();return true;
      }
      candidates.sort((a,b)=>state[b.owner][b.hand]-state[a.owner][a.hand]);
      return resolveSforzando(player,candidates[0].owner,candidates[0].hand);
    }

    function resolveSforzando(player,owner,hand){
      if(![player,otherPlayer(player)].includes(owner)||!["L","R"].includes(hand)||state[owner][hand]<=0)return false;
      const bonus=state[owner][hand];
      state.sforzandoTurnBonus[player]=bonus;state.pendingSforzando=null;state.mode="attack";
      addLog(`${handNames[player]}の「スフォルツァント」。このターンの通常攻撃で加える本数+${bonus}。`);
      render();return true;
    }

    function beginArpeggio(player){
      return useArpeggioV153(player);
      const alive=["L","R"].filter(h=>state[player][h]>0);if(!alive.length){state.pendingTerminalEnd[player]=true;return false;}
      if(player==="human"){state.pendingArpeggio={player};state.mode="arpeggioSource";setMessage("アルペジオ：元にする自分の手を選んでください。");render();return true;}
      const hand=alive.sort((a,b)=>state[player][b]-state[player][a])[0];return resolveArpeggio(player,hand,chooseCpuArpeggioSplit(player,state[player][hand]));
    }
    function chooseCpuArpeggioSplit(player,total){const o=otherPlayer(player);for(let l=0;l<=total;l++){if(wrapFinger(state[o].L+l)===0&&wrapFinger(state[o].R+total-l)===0)return l;}return Math.floor(total/2);}
    async function resolveArpeggio(player,sourceHand,leftAmount){const total=state[player][sourceHand];if(total<=0||leftAmount<0||leftAmount>total)return false;const o=otherPlayer(player);const right=total-leftAmount;for(const [h,n] of [["L",leftAmount],["R",right]]){if(n<=0)continue;const reduced=applyGuardBlessingReduction(o,h,n,"アルペジオ");const sum=state[o][h]+reduced;state[o][h]=normalize(sum,o,h);}state.pendingArpeggio=null;state.mode="attack";state.pendingTerminalEnd[player]=true;clearBrokenTraps(o);render();return true;}

    function recordRondoUse(player,cardId){
      if(state.selectedTheme?.[player]!=="rondo"||cardId==="themeSetting")return;
      const card=CARD_LIBRARY[cardId];
      if(card?.rondo){const used=state.usedRondoCards[player]||[];if(used.includes(cardId))changePerformanceLevel(player,-1,"使用済みの輪舞曲を再使用");else{changePerformanceLevel(player,2,"初使用の輪舞曲");used.push(cardId);state.usedRondoCards[player]=used;}}
      else if(cardId!=="performance")changePerformanceLevel(player,-1,"非輪舞曲を使用");
      render();
    }
    async function applyResolvedFingerAddition(targetPlayer,targetHand,amount,sourceLabel="確定済み加算"){
      if(state[targetPlayer][targetHand]<=0)return false;
      const before=state[targetPlayer][targetHand];
      const numericAmount=Number(amount)||0;
      const total=before+numericAmount;
      const finalValue=numericAmount<0?Math.max(0,total):wrapFinger(total);
      await animateCalculation(targetPlayer,targetHand,total,finalValue);
      state[targetPlayer][targetHand]=finalValue;
      addLog(`${sourceLabel}：${handNames[targetPlayer]}の${handNames[targetHand]} ${before}→${total}${numericAmount>=0&&total>=5?`→${finalValue}`:""}。`);
      clearBrokenTraps(targetPlayer);
      render();
      return true;
    }
    async function resolveCanonHitsForEndingPlayer(player){
      const due=state.pendingCanonHits.filter(x=>x.waitForPlayer===player);state.pendingCanonHits=state.pendingCanonHits.filter(x=>x.waitForPlayer!==player);
      for(const hit of due){
        if(state[hit.defender][hit.targetHand]<=0){addLog(`${handNames[hit.sourcePlayer]}の「カノン」は記録対象が0のため不発。`);continue;}
        await applyResolvedFingerAddition(hit.defender,hit.targetHand,hit.amount,"カノン");
      }
      render();
    }

    function hasCanonHitsDueForEndingPlayer(player) {
      return state.pendingCanonHits.some(hit => hit.waitForPlayer === player);
    }

    function ensureChantCinematicOverlay() {
      let overlay = document.getElementById("chantCinematicOverlay");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "chantCinematicOverlay";
      overlay.className = "chant-cinematic-overlay";
      document.body.appendChild(overlay);
      return overlay;
    }

    async function showMagicalChantStage(player, stage) {
      const line = MAGICAL_CHANT_LINES[stage - 1];
      const overlay = ensureChantCinematicOverlay();
      const circles = [1, 2, 3].map(n =>
        `<i class="chant-cinematic-circle circle-${n} ${n <= stage ? "active" : ""}"><span></span></i>`
      ).join("");
      const seals = [1, 2, 3].map(n => `<span class="chant-cinematic-seal ${n <= stage ? "lit" : ""}">${n}</span>`).join("");
      overlay.className = `chant-cinematic-overlay stage-${stage}`;
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="chant-cinematic-particles"></div>
        <div class="chant-cinematic-circles">${circles}</div>
        <div class="chant-cinematic-copy">
          <div class="chant-cinematic-user">${escapeHtml(handNames[player])}の詠唱</div>
          <div class="chant-cinematic-phase">CHANT PHASE ${stage}</div>
          <div class="chant-cinematic-line">${escapeHtml(line)}</div>
          <div class="chant-cinematic-progress">${seals}</div>
          <div class="chant-cinematic-count">詠唱進捗 ${stage} / 3</div>
        </div>`;
      overlay.classList.add("show");
      await delay(stage === 3 ? 3400 : 2550);
      overlay.classList.add("closing");
      await delay(480);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function showArcanaSlaveCinematic(player) {
      const overlay = ensureChantCinematicOverlay();
      const circles = [1, 2, 3].map(n => `<i class="chant-cinematic-circle circle-${n} active"><span></span></i>`).join("");
      const seals = [1, 2, 3].map(n => `<span class="chant-cinematic-seal lit">${n}</span>`).join("");
      overlay.className = "chant-cinematic-overlay stage-3 arcana-cast";
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="chant-cinematic-particles"></div>
        <div class="chant-cinematic-circles">${circles}</div>
        <div class="chant-cinematic-copy">
          <div class="chant-cinematic-user">${escapeHtml(handNames[player])}の大魔法</div>
          <div class="chant-cinematic-phase">ARCANA RELEASE</div>
          <div class="chant-cinematic-line arcana-cast-line">アルカナ・スレイブ！！</div>
          <div class="chant-cinematic-progress">${seals}</div>
          <div class="chant-cinematic-count">詠唱工程 完了</div>
        </div>`;
      overlay.classList.add("show");
      await delay(3000);
      overlay.classList.add("closing");
      await delay(520);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function showArcanaTargetCircle(player, hand) {
      const target = handEl(player, hand);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.className = "arcana-target-circle-overlay";
      overlay.style.left = `${rect.left + rect.width / 2}px`;
      overlay.style.top = `${rect.top + rect.height / 2}px`;
      overlay.style.width = `${Math.max(rect.width, rect.height) * 1.35}px`;
      overlay.style.height = overlay.style.width;
      overlay.innerHTML = `<i></i><i></i><span>✦</span>`;
      document.body.appendChild(overlay);
      target.classList.add("arcana-targeted-hand");
      await delay(1050);
      overlay.classList.add("burst");
      await delay(420);
      overlay.remove();
      target.classList.remove("arcana-targeted-hand");
    }


    async function showJudgmentCinematic(player, verdict) {
      const overlay = ensureChantCinematicOverlay();
      overlay.className = "chant-cinematic-overlay judgment-cast";
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="courtroom-columns"><i></i><i></i><i></i><i></i></div>
        <div class="courtroom-gavel" aria-hidden="true">
          <span class="gavel-shadow"></span>
          <span class="gavel-block"></span>
          <span class="gavel-handle"></span>
          <span class="gavel-head"></span>
          <span class="gavel-band"></span>
          <span class="gavel-impact"></span>
        </div>
        <div class="chant-cinematic-copy judgment-cast-copy">
          <div class="chant-cinematic-user">${escapeHtml(handNames[player])}の宣告</div>
          <div class="chant-cinematic-phase">COURT VERDICT</div>
          <div class="judgment-main-title">最終判決</div>
          <div class="judgment-verdict">${escapeHtml(verdict)}</div>
          <div class="chant-cinematic-count judgment-count">判決言渡し</div>
        </div>`;
      overlay.classList.add("show");
      await delay(1100);
      overlay.classList.add("verdict-phase");
      await delay(1700);
      overlay.classList.add("closing");
      await delay(480);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function showExecutionCinematic(player) {
      const overlay = ensureChantCinematicOverlay();
      overlay.className = "chant-cinematic-overlay execution-cast";
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="courtroom-columns"><i></i><i></i><i></i><i></i></div>
        <div class="judgment-scale execution-scale" aria-hidden="true">
          <span class="scale-top"></span>
          <span class="scale-beam"></span>
          <span class="scale-post"></span>
          <span class="scale-foot"></span>
          <span class="scale-chain left"></span>
          <span class="scale-chain right"></span>
          <span class="scale-pan left"></span>
          <span class="scale-pan right"></span>
        </div>
        <div class="chant-cinematic-copy execution-cast-copy">
          <div class="chant-cinematic-user">${escapeHtml(handNames[player])}の執行</div>
          <div class="chant-cinematic-phase">COURT EXECUTION</div>
          <div class="judgment-main-title execution-main-title">執行</div>
          <div class="execution-subtitle">判決を、ここに執行する</div>
        </div>`;
      overlay.classList.add("show");
      await delay(2150);
      overlay.classList.add("closing");
      await delay(420);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function showExecutionTargetSeal(player, hand) {
      const target = handEl(player, hand);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.className = "execution-target-seal-overlay";
      overlay.style.left = `${rect.left + rect.width / 2}px`;
      overlay.style.top = `${rect.top + rect.height / 2}px`;
      overlay.style.width = `${Math.max(rect.width, rect.height) * 1.48}px`;
      overlay.style.height = overlay.style.width;
      overlay.innerHTML = `<i></i><i></i><span>裁</span>`;
      document.body.appendChild(overlay);
      target.classList.add("execution-targeted-hand");
      await delay(980);
      overlay.classList.add("burst");
      await delay(420);
      overlay.remove();
      target.classList.remove("execution-targeted-hand");
    }


    async function showTiltedScalesCinematic(leftPlayer, leftCount, rightPlayer, rightCount) {
      const overlay = ensureChantCinematicOverlay();
      const heavier = leftCount === rightCount ? "balanced" : (leftCount > rightCount ? "left-heavy" : "right-heavy");
      const verdict = leftCount === rightCount ? "均衡" : (leftCount > rightCount ? `${handNames[leftPlayer]}が重い` : `${handNames[rightPlayer]}が重い`);
      overlay.className = `chant-cinematic-overlay tilted-scales-cast ${heavier}`;
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="courtroom-columns"><i></i><i></i><i></i><i></i></div>
        <div class="tilted-scale-stage" aria-hidden="true">
          <div class="tilted-scale-title">傾いた天秤</div>
          <div class="tilted-scale-subtitle">両者の合計本数を比較</div>
          <div class="tilted-scale-figure ${heavier}">
            <span class="tilted-scale-pivot"></span>
            <span class="tilted-scale-beam"></span>
            <span class="tilted-scale-post"></span>
            <span class="tilted-scale-foot"></span>
            <span class="tilted-scale-chain left"></span>
            <span class="tilted-scale-chain right"></span>
            <span class="tilted-scale-pan left">
              <b class="tilted-scale-name">${escapeHtml(handNames[leftPlayer])}</b>
              <strong class="tilted-scale-count">${leftCount}</strong>
            </span>
            <span class="tilted-scale-pan right">
              <b class="tilted-scale-name">${escapeHtml(handNames[rightPlayer])}</b>
              <strong class="tilted-scale-count">${rightCount}</strong>
            </span>
          </div>
          <div class="tilted-scale-verdict">${escapeHtml(verdict)}</div>
        </div>`;
      overlay.classList.add("show");
      await delay(650);
      overlay.classList.add("result-phase");
      await delay(1750);
      overlay.classList.add("closing");
      await delay(460);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function showMagicalChantComplete(player) {
      const overlay = ensureChantCinematicOverlay();
      const circles = [1, 2, 3].map(n => `<i class="chant-cinematic-circle circle-${n} active"><span></span></i>`).join("");
      overlay.className = "chant-cinematic-overlay complete";
      overlay.innerHTML = `
        <div class="chant-cinematic-vignette"></div>
        <div class="chant-cinematic-particles"></div>
        <div class="chant-cinematic-circles">${circles}</div>
        <div class="chant-complete-flash"></div>
        <div class="chant-cinematic-copy chant-complete-copy">
          <div class="chant-cinematic-user">${escapeHtml(handNames[player])}の詠唱</div>
          <div class="chant-complete-label">CHANT COMPLETE</div>
          <div class="chant-complete-title">アルカナ・スレイブ！！</div>
          <div class="chant-complete-sub">すべての同名カードが大魔法へ変化した</div>
        </div>`;
      overlay.classList.add("show");
      await delay(2700);
      overlay.classList.add("closing");
      await delay(520);
      overlay.className = "chant-cinematic-overlay";
      overlay.innerHTML = "";
    }

    async function useMagicalChant(player) {
      state.magicalChantProgress = state.magicalChantProgress || { human: 0, cpu: 0 };
      state.magicalChantCompleted = state.magicalChantCompleted || { human: false, cpu: false };
      const next = Math.min(3, Number(state.magicalChantProgress[player] || 0) + 1);
      state.magicalChantProgress[player] = next;
      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        await emitFriendFx("magicalChant", {
          playerSide: friendSideForLocalPlayer(player),
          stage: next,
          completed: next >= 3
        }).catch(error => console.error("PVP magical chant fx failed", error));
      }
      await showMagicalChantStage(player, next);
      addLog(`${handNames[player]}の「魔法少女の詠唱」が${next}/3まで進んだ。`);
      returnOneCardFromDiscardToDeck(player, "magicalChant");
      if (next >= 3) {
        state.magicalChantCompleted[player] = true;
        transformMagicalChantCards(player);
        await showMagicalChantComplete(player);
        addLog(`${handNames[player]}は詠唱を完成させた。以後、同名カードは「アルカナ・スレイブ！！」になる。`);
      } else {
        addLog(`使用した「魔法少女の詠唱」は山札へ戻り、山札をシャッフルした。`);
      }
    }

    async function beginArcanaSlave(player) {
      const opponent = otherPlayer(player);
      const alive = ["L","R"].filter(h => state[opponent][h] > 0);
      if (!alive.length) return false;
      if (player === "human") {
        state.mode = "arcanaSlaveTarget";
        setMessage("「アルカナ・スレイブ！！」：0にする相手の手を選んでください。");
        return true;
      }
      const target = alive.sort((a,b) => state[opponent][b] - state[opponent][a])[0];
      if (state.battleMode === "friend" && player === "human") {
        await emitFriendFx("arcanaSlave", {
          playerSide: friendSideForLocalPlayer(player),
          targetSide: friendSideForLocalPlayer(opponent),
          targetHand: target
        });
      }
      await showArcanaSlaveCinematic(player);
      await showArcanaTargetCircle(opponent, target);
      const targetBefore=state[opponent][target];state[opponent][target] = 0;markDirectiveOpponentZero(player,opponent,targetBefore);
      clearBrokenTraps(opponent);
      state.pendingTerminalEnd[player] = true;
      addLog(`${handNames[player]}の「アルカナ・スレイブ！！」が${handNames[opponent]}の${handNames[target]}を0にした。`);
      return true;
    }

    function ensureMagicalChoiceOverlay() {
      let overlay = document.getElementById("magicalChoiceOverlay");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "magicalChoiceOverlay";
      overlay.className = "magical-choice-overlay";
      overlay.innerHTML = `<div class="magical-choice-panel"><h2></h2><p class="magical-choice-guide"></p><div class="magical-choice-list"></div><div class="magical-choice-actions"></div></div>`;
      document.body.appendChild(overlay);
      return overlay;
    }

    function magicalChoiceCardHtml(item, selected = false) {
      const card = CARD_LIBRARY[item.id] || { name: item.id, type: "カード", cost: "?", text: "" };
      return `<button type="button" class="magical-choice-card${selected ? " selected" : ""}" data-key="${escapeHtml(item.key)}">
        <span class="magical-choice-name">${escapeHtml(card.name)}</span>
        ${item.location ? `<span class="magical-choice-location">${escapeHtml(item.location)}</span>` : ""}
        <span class="magical-choice-type">${escapeHtml(card.type)}</span>
        <span class="magical-choice-cost">コスト ${card.cost}</span>
        <span class="magical-choice-text">${escapeHtml(card.text)}</span>
      </button>`;
    }

    function chooseOneMagicalCard(title, guide, items) {
      return new Promise(resolve => {
        const overlay = ensureMagicalChoiceOverlay();
        overlay.querySelector("h2").textContent = title;
        overlay.querySelector(".magical-choice-guide").textContent = guide;
        const list = overlay.querySelector(".magical-choice-list");
        list.innerHTML = items.map(item => magicalChoiceCardHtml(item)).join("");
        overlay.querySelector(".magical-choice-actions").innerHTML = "";
        overlay.classList.add("show");
        list.querySelectorAll(".magical-choice-card").forEach(button => {
          button.addEventListener("click", () => {
            overlay.classList.remove("show");
            resolve(items.find(item => item.key === button.dataset.key));
          }, { once: true });
        });
      });
    }

    function gameChoiceCardHtml(item) {
      const base = CARD_LIBRARY[item.id] || {};
      const name = item.name || base.name || item.id || "選択肢";
      const type = item.type || base.type || "選択";
      const cost = item.cost ?? base.cost ?? "-";
      const text = item.text || base.text || "";
      return `<button type="button" class="magical-choice-card" data-key="${escapeHtml(String(item.key))}">
        <span class="magical-choice-name">${escapeHtml(name)}</span>
        <span class="magical-choice-type">${escapeHtml(type)}</span>
        <span class="magical-choice-cost">コスト ${escapeHtml(cost)}</span>
        <span class="magical-choice-text">${escapeHtml(text)}</span>
      </button>`;
    }

    function showGameChoicePanel({ title, message, choices }) {
      const items = choices.map((choice, index) => ({ ...choice, key: String(choice.key ?? choice.value ?? index) }));
      return new Promise(resolve => {
        const overlay = ensureMagicalChoiceOverlay();
        overlay.querySelector("h2").textContent = title;
        overlay.querySelector(".magical-choice-guide").textContent = message;
        const list = overlay.querySelector(".magical-choice-list");
        list.innerHTML = items.map(gameChoiceCardHtml).join("");
        overlay.querySelector(".magical-choice-actions").innerHTML = "";
        overlay.classList.add("show");
        list.querySelectorAll(".magical-choice-card").forEach(button => {
          button.addEventListener("click", () => {
            overlay.classList.remove("show");
            resolve(items.find(item => item.key === button.dataset.key));
          }, { once: true });
        });
      });
    }

    async function showGameConfirmation({ title, message, confirmLabel, cancelLabel }) {
      const chosen = await showGameChoicePanel({
        title,
        message,
        choices: [
          { key: "confirm", name: confirmLabel, type: "決定", text: message },
          { key: "cancel", name: cancelLabel, type: "選択", text: "追加の効果を行わず、そのまま進めます。" }
        ]
      });
      return chosen?.key === "confirm";
    }

    function showGameConfirmationText(message) {
      return showGameConfirmation({ title: "選択", message, confirmLabel: "自分を選ぶ", cancelLabel: "相手を選ぶ" });
    }

    let pendingBoardHandSelection = null;
    let pendingHandCardSelection = null;
    let pendingNumberAllocation = null;

    function beginBoardHandSelection(player, { owners = [player], allowZero = false, minimum = allowZero ? 0 : 1, candidateFilter = () => true, message = "手を選んでください。", cpuPick = null } = {}) {
      const candidates = [];
      for (const owner of owners) for (const hand of ["L", "R"]) {
        const value = Number(state[owner]?.[hand] || 0);
        const candidate={owner,hand,value};
        if ((allowZero || value > 0) && value >= minimum && candidateFilter(candidate)) candidates.push(candidate);
      }
      if (!candidates.length) return Promise.resolve(null);
      if (player !== "human") return Promise.resolve(cpuPick ? cpuPick(candidates) : candidates[0]);
      return new Promise(resolve => {
        pendingBoardHandSelection = { candidates, resolve };
        state.mode = "boardHandSelection";
        setMessage(message);
        render();
      });
    }

    function finishBoardHandSelection(owner, hand) {
      const pending = pendingBoardHandSelection;
      const selected = pending?.candidates.find(item => item.owner === owner && item.hand === hand);
      if (!pending || !selected) return false;
      pendingBoardHandSelection = null;
      state.mode = "attack";
      pending.resolve(selected);
      render();
      return true;
    }

    function updateHandCardSelectionUi() {
      const pending = pendingHandCardSelection;
      if (!pending) return;
      const count = pending.selected.size;
      elements.handCardSelectionConfirmBtn.disabled = count < pending.min || count > pending.max;
      elements.handCardSelectionHint.textContent = `${count}枚選択中（${pending.min}～${pending.max}枚）`;
    }

    function beginHandCardSelection({ min = 1, max = 1, filter = () => true, message = "手札からカードを選んでください。" } = {}) {
      const eligible = state.hands.human.map((id, index) => ({ id, index })).filter(item => filter(item.id, item.index));
      if (eligible.length < min) return Promise.resolve([]);
      return new Promise(resolve => {
        pendingHandCardSelection = { min, max: Math.min(max, eligible.length), eligible: new Set(eligible.map(item => item.index)), selected: new Set(), resolve };
        state.mode = "handCardSelection";
        elements.handCardSelectionLabel.textContent = message;
        elements.handCardSelectionBox.classList.add("active");
        updateHandCardSelectionUi();
        render();
      });
    }

    function toggleHandCardSelection(index) {
      const pending = pendingHandCardSelection;
      if (!pending?.eligible.has(index)) return false;
      if (pending.selected.has(index)) pending.selected.delete(index);
      else if (pending.selected.size < pending.max) pending.selected.add(index);
      updateHandCardSelectionUi();
      renderHumanCards();
      return true;
    }

    function finishHandCardSelection() {
      const pending = pendingHandCardSelection;
      if (!pending || pending.selected.size < pending.min || pending.selected.size > pending.max) return false;
      const result = [...pending.selected].sort((a, b) => a - b);
      pendingHandCardSelection = null;
      elements.handCardSelectionBox.classList.remove("active");
      state.mode = "attack";
      pending.resolve(result);
      render();
      return true;
    }

    function showNumberAllocation({ title, total }) {
      return new Promise(resolve => {
        pendingNumberAllocation = { total, resolve };
        state.mode = "numberAllocation";
        elements.allocationLabel.textContent = title;
        elements.allocationLeft.innerHTML = "";
        elements.allocationRight.innerHTML = "";
        for (let value = 0; value <= total; value++) {
          elements.allocationLeft.appendChild(new Option(String(value), String(value)));
          elements.allocationRight.appendChild(new Option(String(total - value), String(total - value)));
        }
        const initial = Math.floor(total / 2);
        elements.allocationLeft.value = String(initial);
        elements.allocationRight.value = String(total - initial);
        elements.allocationHint.textContent = `合計 ${total} / ${total}`;
        elements.allocationBox.classList.add("active");
        render();
      });
    }

    function syncNumberAllocation(source) {
      if (!pendingNumberAllocation) return;
      const total = pendingNumberAllocation.total;
      if (source === "left") elements.allocationRight.value = String(total - Number(elements.allocationLeft.value));
      else elements.allocationLeft.value = String(total - Number(elements.allocationRight.value));
      elements.allocationHint.textContent = `合計 ${total} / ${total}`;
    }

    function finishNumberAllocation() {
      const pending = pendingNumberAllocation;
      if (!pending) return false;
      const left = Number(elements.allocationLeft.value);
      const right = Number(elements.allocationRight.value);
      if (!Number.isInteger(left) || !Number.isInteger(right) || left + right !== pending.total) return false;
      pendingNumberAllocation = null;
      elements.allocationBox.classList.remove("active");
      state.mode = "attack";
      pending.resolve({ left, right });
      render();
      return true;
    }

    async function chooseThemeV153(player) {
      let theme;
      if (player === "human") {
        const chosen = await showGameChoicePanel({
          title: "題目を選択",
          message: "この試合で使用する題目を選んでください。",
          choices: [
            { key: "serenade", id: "serenadeTheme" },
            { key: "rondo", id: "rondoTheme" }
          ]
        });
        theme = chosen?.key === "rondo" ? "rondo" : "serenade";
      } else {
        const rondos = state.hands[player].filter(id => CARD_LIBRARY[id]?.rondo).length + state.decks[player].filter(id => CARD_LIBRARY[id]?.rondo).length;
        theme = rondos >= 3 ? "rondo" : "serenade";
      }
      state.selectedTheme[player] = theme;
      ensureThemeAttachments(player);
      state.temp[player].cardExtraUses = Number(state.temp[player].cardExtraUses || 0) + 1;
      addLog(`${handNames[player]}は「題目：${theme === "rondo" ? "ロンド" : "セレナーデ"}」を選択した。`);
      render();
      return true;
    }

    async function useFermataV153(player) {
      drawCard(player);
      const extra = player === "human"
        ? await showGameConfirmation({ title: "フェルマータ", message: "もう1枚引き、ターンを終了しますか？", confirmLabel: "もう1枚引く", cancelLabel: "このまま続ける" })
        : state.hands[player].length < 4;
      if (extra) {
        drawCard(player);
        state.pendingTerminalEnd[player] = true;
      }
      return true;
    }

    async function useDolorosoV153(player) {
      const selected = await beginBoardHandSelection(player, { owners: [player], message: "Doloroso：0にする自分の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>a.value-b.value)[0] });
      if (!selected) return false;
      state[player][selected.hand] = 0;
      clearBrokenTraps(player);
      for (let i = 0; i < 3; i++) drawCard(player);
      render();
      return true;
    }

    async function useAppassionatoV153(player) {
      if (state.temp[player].appassionatoUsedThisTurn) return false;
      const selected = await beginBoardHandSelection(player, { owners: [player], message: "Appassionato：0にする自分の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>a.value-b.value)[0] });
      if (!selected) return false;
      state.temp[player].appassionatoUsedThisTurn = true;
      state[player][selected.hand] = 0;
      clearBrokenTraps(player);
      state.temp[player].cardExtraUses = Number(state.temp[player].cardExtraUses || 0) + 2;
      state.pendingIntemperanceCardLock[player] = true;
      state.pendingCardUseLockSource[player] = "appassionato";
      addLog(`${handNames[player]}は「Appassionato」の反動により、次の自分ターンはカードを使用できない。`);
      render();
      return true;
    }

    async function useLacrimosaV153(player) {
      const opponent = otherPlayer(player);
      if (!(state[player].L > 0 || state[player].R > 0) || state[opponent].L <= 0 || state[opponent].R <= 0) return false;
      const own = await beginBoardHandSelection(player, { owners: [player], message: "Lacrimosa：0にする自分の手を選んでください。", cpuPick: items => items[0] });
      if (!own) return false;
      state[player][own.hand] = 0;
      clearBrokenTraps(player);
      const target = await beginBoardHandSelection(player, { owners: [opponent], message: "Lacrimosa：0にする相手の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>b.value-a.value)[0] });
      if (!target) return false;
      const targetBefore=state[opponent][target.hand];state[opponent][target.hand] = 0;markDirectiveOpponentZero(player,opponent,targetBefore);
      clearBrokenTraps(opponent);
      render();
      return true;
    }

    async function useRequiemV153(player) {
      const selected = await beginBoardHandSelection(player, { owners: [player], message: "Requiem：0にする自分の手を選んでください。", cpuPick: items => items[0] });
      if (!selected) {
        state.pendingTerminalEnd[player] = true;
        return false;
      }
      state[player][selected.hand] = 0;
      clearBrokenTraps(player);
      const opponent = otherPlayer(player);
      const fixedIndexes = state.hands[opponent].map((id,index)=>({id,index})).filter(item=>isExternallyDiscardableHandCard(item.id)).map(item=>item.index);
      await discardFixedHandCardsByEffect(opponent, fixedIndexes, "「Requiem」");
      state.pendingTerminalEnd[player] = true;
      render();
      return true;
    }

    async function usePortamentoV153(player) {
      const selected = await beginBoardHandSelection(player, { owners: [player], message: "ポルタメント：増やす自分の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>b.value-a.value)[0] });
      return selected ? resolvePortamento(player, selected.hand) : false;
    }

    async function useDissonanceV153(player) {
      const selected = await beginBoardHandSelection(player, { owners: [player], message: "ディソナンス：攻撃に使う自分の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>b.value-a.value)[0] });
      return selected ? resolveDissonance(player, selected.hand) : false;
    }

    async function useSforzandoV153(player) {
      const selected = await beginBoardHandSelection(player, { owners: [player, otherPlayer(player)], message: "スフォルツァント：参照する0ではない手を選んでください。", cpuPick: items => [...items].sort((a,b)=>b.value-a.value)[0] });
      return selected ? resolveSforzando(player, selected.owner, selected.hand) : false;
    }

    async function useArpeggioV153(player) {
      const source = await beginBoardHandSelection(player, { owners: [player], message: "アルペジオ：元にする自分の手を選んでください。", cpuPick: items => [...items].sort((a,b)=>b.value-a.value)[0] });
      if (!source) return false;
      let left;
      if (player === "human") {
        const allocation = await showNumberAllocation({ title: `アルペジオ：${source.value}本を相手の左右へ割り振ってください。`, total: source.value });
        left = allocation.left;
      } else {
        const opponent = otherPlayer(player);
        const winning = Array.from({length: source.value + 1}, (_, value) => value).find(value => normalize(state[opponent].L + value, opponent, "L") === 0 && normalize(state[opponent].R + source.value - value, opponent, "R") === 0);
        left = winning ?? Math.floor(source.value / 2);
      }
      return resolveArpeggio(player, source.hand, left);
    }

    async function useFullHeartV153(player) {
      const handItems = state.hands[player].map((id,index)=>({id,index,key:`hand-${index}`})).filter(item=>isExternallyDiscardableHandCard(item.id));
      if (!handItems.length) return false;
      let indexes;
      if (player === "human") {
        indexes = await beginHandCardSelection({
          min: 1,
          max: state.hands.human.length,
          filter: isExternallyDiscardableHandCard,
          message: "満ちる心：捨てる手札を選び、決定してください。"
        });
      } else {
        indexes = state.hands[player].map((_, index) => index).filter(index => isExternallyDiscardableHandCard(state.hands[player][index])).slice(0, Math.max(1, Math.ceil(handItems.length / 2)));
      }
      if (!indexes.length) return false;
      const count = indexes.length;
      for (const index of [...indexes].sort((a,b)=>b-a)) await discardHandCardByEffect(player, index);
      await discardRandomCards(otherPlayer(player), count, "「満ちる心」");
      return true;
    }

    function chooseMultipleMagicalCards(title, guide, items, minimum = 1) {
      return new Promise(resolve => {
        const overlay = ensureMagicalChoiceOverlay();
        overlay.querySelector("h2").textContent = title;
        overlay.querySelector(".magical-choice-guide").textContent = guide;
        const list = overlay.querySelector(".magical-choice-list");
        const actions = overlay.querySelector(".magical-choice-actions");
        const selected = new Set();
        list.innerHTML = items.map(item => magicalChoiceCardHtml(item)).join("");
        actions.innerHTML = `<button type="button" class="magical-choice-confirm" disabled>選択を決定（0枚）</button>`;
        const confirm = actions.querySelector("button");
        const update = () => {
          confirm.disabled = selected.size < minimum;
          confirm.textContent = `選択を決定（${selected.size}枚）`;
        };
        list.querySelectorAll(".magical-choice-card").forEach(button => {
          button.addEventListener("click", () => {
            const key = button.dataset.key;
            if (selected.has(key)) selected.delete(key); else selected.add(key);
            button.classList.toggle("selected", selected.has(key));
            update();
          });
        });
        confirm.addEventListener("click", () => {
          if (selected.size < minimum) return;
          overlay.classList.remove("show");
          resolve(items.filter(item => selected.has(item.key)));
        }, { once: true });
        overlay.classList.add("show");
        update();
      });
    }

    async function useWornHope(player) {
      const recoverable = ["magicalHatred","magicalDespair","magicalGreed","magicalWrath","magicalVoid"];
      if (!state.hands[player].length) return false;
      let discardIndex;
      if (player === "human") {
        const chosen = await chooseOneMagicalCard("すり減る希望", "まず、捨てる自分の手札を1枚タップしてください。", handItems);
        discardIndex = chosen.index;
      } else {
        discardIndex = handItems[randomIndex(handItems.length)].index;
      }
      const discardedId = await discardHandCardByEffect(player, discardIndex);
      addLog(`${handNames[player]}は「すり減る希望」で「${CARD_LIBRARY[discardedId]?.name || discardedId}」を捨てた。`);

      const candidates = state.discard[player].map((id, index) => ({ id, index, key: `discard-${index}` })).filter(item => recoverable.includes(item.id));
      if (!candidates.length) {
        addLog(`「すり減る希望」で山札へ戻せる感情カードがなかった。`);
        render();
        return false;
      }
      let chosen;
      if (player === "human") {
        chosen = await chooseOneMagicalCard("すり減る希望", "山札へ戻す感情カードをタップしてください。", candidates);
      } else {
        chosen = candidates[randomIndex(candidates.length)];
      }
      const [returnedId] = state.discard[player].splice(chosen.index, 1);
      state.decks[player].push(returnedId);
      shuffle(state.decks[player]);
      addLog(`${handNames[player]}は「${CARD_LIBRARY[returnedId]?.name || returnedId}」を山札へ戻し、シャッフルした。`);
      render();
      return true;
    }

    function useTogetherWithFriends(player){const n=Math.min(3,state.discard[player].length);for(let i=0;i<n;i++)state.decks[player].push(state.discard[player].splice(randomIndex(state.discard[player].length),1)[0]);shuffle(state.decks[player]);drawCard(player);drawCard(player);drawCard(player);}

    async function useHysteria(player) {
      const handBlessings = state.hands[player].map((id,index)=>({id,index,key:`hand-${index}`})).filter(item => CARD_LIBRARY[item.id]?.blessing && isExternallyDiscardableHandCard(item.id));
      const deckBlessings = state.decks[player].map((id,index)=>({id,index})).filter(item => CARD_LIBRARY[item.id]?.blessing && !CARD_LIBRARY[item.id]?.token);
      if (!handBlessings.length || !deckBlessings.length) return false;
      const lost = player === "human"
        ? await chooseOneMagicalCard("ヒステリー", "捨てる手札の加護カードをタップしてください。", handBlessings)
        : handBlessings[randomIndex(handBlessings.length)];
      const lostId = await discardHandCardByEffect(player, lost.index);
      const refreshed = state.decks[player].map((id,index)=>({id,index})).filter(item => CARD_LIBRARY[item.id]?.blessing && !CARD_LIBRARY[item.id]?.token);
      if (!refreshed.length) {
        addLog(`${handNames[player]}は「ヒステリー」で加護を捨てたが、山札に引ける加護がなかった。`);
        render();
        return false;
      }
      const gain = refreshed[randomIndex(refreshed.length)];
      state.decks[player].splice(gain.index, 1);
      state.hands[player].push(gain.id);
      addLog(`${handNames[player]}は「ヒステリー」で「${CARD_LIBRARY[lostId]?.name || lostId}」を捨て、山札から「${CARD_LIBRARY[gain.id]?.name || gain.id}」を引いた。`);
      render();
      return true;
    }

    function getOwnBlessingAttachments(player) {
      const result = [];
      for (const hand of ["L", "R"]) {
        state.traps[player][hand].forEach((slot, index) => {
          const id = trapCardId(slot);
          if (CARD_LIBRARY[id]?.blessing && isExternallyRemovableAttachment(id)) result.push({ id, hand, index, key: `${hand}-${index}`, location: `${handNames[hand]}の加護` });
        });
      }
      return result;
    }

    async function useSacrificePower(player) {
      const blessings = getOwnBlessingAttachments(player);
      if (!blessings.length) return false;
      const selected = player === "human"
        ? await chooseMultipleMagicalCards("犠牲の力", "捨てる加護を好きな数だけ選び、決定してください。", blessings, 1)
        : blessings;
      const grouped = { L: [], R: [] };
      selected.forEach(item => grouped[item.hand].push(item));
      for (const hand of ["L", "R"]) {
        grouped[hand].sort((a,b) => b.index - a.index).forEach(item => {
          const slot = state.traps[player][hand].splice(item.index, 1)[0];
          const id = trapCardId(slot);
          if (id) state.discard[player].push(id);
        });
      }
      state.temp[player].attackBonus = Number(state.temp[player].attackBonus || 0) + selected.length;
      addLog(`${handNames[player]}は「犠牲の力」で加護を${selected.length}枚捨て、次の通常攻撃で加える本数+${selected.length}。`);
      render();
      return true;
    }
    function beginWithLove(player){if(player==="human"){state.mode="magicalWithLove";setMessage("「愛で！」：2にする自分の手を選んでください。0の手も選べます。");}else{const h=state[player].L===0?"L":state[player].R===0?"R":"L";state[player][h]=2;clearBrokenTraps(player);drawCard(player);}}
    async function useFadedCreed(player){const c=["L","R"].filter(h=>state[player][h]>0);if(!c.length)return false;await addFingersWithCalculation(player,c[randomIndex(c.length)],1,"色褪せた信条");state.temp[player].fadedCreedGuard=true;}
    function beginBetrayedHeart(player){state.temp[player].betrayedHeartPenalty=true;if(player==="human"){state.mode="magicalBetrayedHeart";setMessage("「裏切られた心」：1本増やす自分の0でない手を選んでください。");}else{const c=["L","R"].filter(h=>state[player][h]>0);if(c.length)addFingersWithCalculation(player,c[randomIndex(c.length)],1,"裏切られた心");}}
    async function useEmptyHeart(player){const indexes=state.hands[player].map((id,index)=>({id,index})).filter(item=>isExternallyDiscardableHandCard(item.id)).map(item=>item.index),discarded=await discardFixedHandCardsByEffect(player,indexes,"「空虚な心」");state.pendingMagicalHeartDraw=state.pendingMagicalHeartDraw||{human:0,cpu:0};state.pendingMagicalHeartDraw[player]=(state.pendingMagicalHeartDraw[player]||0)+discarded.length;}
    async function useFullHeart(player){return useFullHeartV153(player);}
    const MAGICAL_CORE_MAP = {
      magicalHatred: "magicalLove",
      magicalDespair: "magicalJustice",
      magicalGreed: "magicalHappiness",
      magicalWrath: "magicalCourage"
    };

    function magicalCoreLocations(player) {
      const found = {};
      for (const hand of ["L","R"]) {
        state.traps[player][hand].forEach((slot,index) => {
          const id = trapCardId(slot);
          if (MAGICAL_CORE_MAP[id] && !found[id]) found[id] = { hand, index, slot };
        });
      }
      return found;
    }

    function canActivateMagicalVoid(player) {
      const found = magicalCoreLocations(player);
      return Object.keys(MAGICAL_CORE_MAP).every(id => !!found[id]);
    }

    function hasAnyMagicalTransformed(player, hand=null) {
      const hands = hand ? [hand] : ["L","R"];
      return hands.some(h => state.traps[player][h].some(slot => CARD_LIBRARY[trapCardId(slot)]?.magicalTransformed));
    }

    function hasMagicalJustice(player) {
      return hasAttachment(player,"L","magicalJustice") || hasAttachment(player,"R","magicalJustice");
    }

    function hasMagicalCourage(player) {
      return hasAttachment(player,"L","magicalCourage") || hasAttachment(player,"R","magicalCourage");
    }

    async function showMagicalTransformationFx() {
      const fx = document.getElementById("magicalTransformFx");
      if (!fx) return;

      fx.classList.remove("show");
      // 再使用時にもCSSアニメーションを最初から再生する。
      void fx.offsetWidth;
      fx.classList.add("show");
      fx.setAttribute("aria-hidden", "false");

      try {
        await delay(3600);
      } finally {
        // 演出中に別処理で例外が起きても、操作不能な全画面レイヤーを必ず解除する。
        fx.classList.remove("show");
        fx.setAttribute("aria-hidden", "true");
      }
    }

    async function activateMagicalVoid(player) {
      if (!canActivateMagicalVoid(player)) {
        addLog(`${handNames[player]}の「虚無」は4つの感情が揃っていないため不発。`);
        return false;
      }

      const found = magicalCoreLocations(player);
      const completeSet = Object.keys(MAGICAL_CORE_MAP).every(id => !!found[id]);
      if (!completeSet) {
        addLog(`${handNames[player]}の「虚無」は変身対象を確認できず不発。`);
        return false;
      }

      state.animating = true;
      render();

      try {
        if (player === "human" || state.battleMode !== "friend") {
          await showMagicalTransformationFx();
        }

        transformMagicalEvolutionCards(player);

        for (const [beforeId, afterId] of Object.entries(MAGICAL_CORE_MAP)) {
          const loc = found[beforeId];
          const currentSlot = state.traps[player][loc.hand][loc.index];
          if (typeof currentSlot === "string") {
            state.traps[player][loc.hand][loc.index] = afterId;
          } else {
            state.traps[player][loc.hand][loc.index] = { ...currentSlot, cardId: afterId };
          }
        }

        addLog(`${handNames[player]}の「虚無」により、憎悪・絶望・貪欲・憤怒が愛・正義・幸福・勇気へ変化した。`);
        setMessage("ジョーカーが光へ溶け、4つのスートが新たな加護へ結ばれた。");

        if (state.battleMode === "friend" && player === "human") {
          state.friendLastPublishedSignature = "";
          await publishFriendStateNow().catch(error => {
            console.error("PVP magical transformation sync failed", error);
            scheduleFriendStatePublish();
          });
        }
        return true;
      } catch (error) {
        console.error("Magical Void activation failed", error);
        addLog(`「虚無」の変身処理中にエラーが発生した。`);
        setMessage(`「虚無」の変身処理エラー：${error?.message || error}`);
        return false;
      } finally {
        state.animating = false;
        const fx = document.getElementById("magicalTransformFx");
        fx?.classList.remove("show");
        fx?.setAttribute("aria-hidden", "true");
        render();
      }
    }

    async function discardHandCardByEffect(player, handIndex, reason = "") {
      if(isRomanOpponentTarget(state.resolvingEffectPlayer,player))return null;
      if(!canDiscardHandCard(player,handIndex,reason==="fatigue"?"fatigue":"cardEffect")) return null;
      ensureHandCardInstances(player);
      const [cardId] = state.hands[player].splice(handIndex, 1);
      state.handCardInstances[player].splice(handIndex,1);
      if (!cardId) return null;
      state.discard[player].push(cardId);
      if (reason) addLog(`${reason}：${handNames[player]}は「${CARD_LIBRARY[cardId]?.name || cardId}」を捨てた。`);
      await handleCardDiscardEffect(player, cardId);
      return cardId;
    }

    async function discardFixedHandCardsByEffect(player, indexes, reason = "") {
      if(isRomanOpponentTarget(state.resolvingEffectPlayer,player))return [];
      const fixed = [...new Set(indexes)]
        .filter(index => Number.isInteger(index) && index >= 0 && index < state.hands[player].length)
        .sort((a, b) => a - b)
        .map(index => ({ index, cardId: state.hands[player][index] }))
        .filter(item => canDiscardHandCard(player,item.index,reason==="fatigue"?"fatigue":"cardEffect"));
      ensureHandCardInstances(player);
      for (const item of [...fixed].sort((a, b) => b.index - a.index)) {
        state.hands[player].splice(item.index, 1);
        state.handCardInstances[player].splice(item.index,1);
      }
      for (const item of fixed) {
        state.discard[player].push(item.cardId);
        if (reason) addLog(`${reason}：${handNames[player]}は「${CARD_LIBRARY[item.cardId]?.name || item.cardId}」を捨てた。`);
      }
      for (const item of fixed) await handleCardDiscardEffect(player, item.cardId);
      return fixed.map(item => item.cardId);
    }

    async function discardRandomCards(player,count,reason) {
      const candidates=getDiscardCandidates(player,"randomDiscard"),picked=[],limit=Math.max(0,Math.min(Number(count)||0,candidates.length));
      for(let i=0;i<limit;i++){const at=Math.floor(Math.random()*candidates.length);picked.push(candidates.splice(at,1)[0]);}
      const ids=await discardFixedHandCardsByEffect(player,picked.map(x=>x.index),reason);return ids.length;
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

    function findAttachmentSlot(owner, hand, cardId) {
      return state.traps[owner][hand].find(slot => trapCardId(slot) === cardId) || null;
    }

    function duelSurgeStats(level) {
      const lv = Math.max(0, Math.min(5, Number(level) || 0));
      if (lv >= 5) return { attack: 2, defense: 2 };
      if (lv >= 4) return { attack: 2, defense: 1 };
      if (lv >= 3) return { attack: 1, defense: 1 };
      if (lv >= 2) return { attack: 1, defense: 0 };
      return { attack: 0, defense: 0 };
    }

    function updateDuelSurge(attacker, attackHand, defender, targetHand) {
      const slot = findAttachmentSlot(attacker, attackHand, "duelSurge");
      if (!slot || typeof slot === "string") return { bonus: 0, level: 0 };
      const sameTarget = slot.duelTargetOwner === defender && slot.duelTargetHand === targetHand;
      slot.level = sameTarget ? Math.min(5, (Number(slot.level) || 0) + 1) : 1;
      slot.duelTargetOwner = defender;
      slot.duelTargetHand = targetHand;
      const stats = duelSurgeStats(slot.level);
      addLog(`${handNames[attacker]}の${handNames[attackHand]}の「決闘高潮」がLv.${slot.level}になった。対象：${defender === attacker ? "自分" : handNames[defender]}の${handNames[targetHand]}。`);
      return { bonus: stats.attack, level: slot.level };
    }

    function duelSurgeDefense(owner, hand) {
      const slot = findAttachmentSlot(owner, hand, "duelSurge");
      if (!slot || typeof slot === "string") return 0;
      return duelSurgeStats(slot.level).defense;
    }

    function discardAllBlessingsFromHand(owner, hand, sourceLabel = "効果") {
      const slots = state.traps[owner][hand];
      const removed = [];
      for (let i = slots.length - 1; i >= 0; i--) {
        const cardId = trapCardId(slots[i]);
        if (!CARD_LIBRARY[cardId]?.blessing || !isExternallyRemovableAttachment(cardId)) continue;
        const [slot] = slots.splice(i, 1);
        const instanceId = trapInstanceId(slot);
        if (instanceId) state.revealedTrapIds.delete(instanceId);
        state.discard[owner].push(cardId);
        removed.push(cardId);
      }
      if (removed.length > 0) {
        addLog(`${sourceLabel}により、${handNames[owner]}の${handNames[hand]}に付いていた加護「${removed.map(id => CARD_LIBRARY[id]?.name || id).join("」「")}」をすべて捨てた。`);
      } else {
        addLog(`${sourceLabel}が攻撃対象を捉えたが、捨てる加護はなかった。`);
      }
      return removed.length;
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
      const originalIncoming=Math.max(0,Number(amount)||0);
      let finalAmount = Math.max(0, amount);
      const barrierReduction = state.energyBarrier?.[defender] || 0;
      if (barrierReduction > 0) {
        const reduced = Math.max(0, finalAmount - barrierReduction);
        addLog(`${handNames[defender]}の「エネルギーバリア」により、${sourceLabel}の本数が${finalAmount}→${reduced}。`);
        finalAmount = reduced;
      }
      const directiveReduction = state.activeDirectiveBlessing?.[defender] || 0;
      const isOpponentTurn = state.turn !== defender;
      if (directiveReduction > 0 && isOpponentTurn && hasAttachment(defender, targetHand, "directiveBlessing")) {
        const reduced = Math.max(1, finalAmount - directiveReduction);
        if (reduced !== finalAmount) {
          addLog(`${handNames[defender]}の「指令の加護」により、${sourceLabel}の本数が${finalAmount}→${reduced}になった。`);
        } else {
          addLog(`${handNames[defender]}の「指令の加護」が働いたが、最低1本のため${sourceLabel}は${finalAmount}本のまま。`);
        }
        finalAmount = reduced;
      }
      if (hasAttachment(defender, targetHand, "guardBlessing")) {
        const reduced = Math.max(1, finalAmount - 1);
        if (reduced !== finalAmount) {
          addLog(`${handNames[defender]}の${handNames[targetHand]}の「守護」により、${sourceLabel}の本数が${finalAmount}→${reduced}になった。`);
        } else {
          addLog(`${handNames[defender]}の${handNames[targetHand]}には「守護」があるが、${sourceLabel}は1本未満にならない。`);
        }
        finalAmount = reduced;
      }
      const dischargeReduction=hasAttachment(defender,targetHand,"dischargeBlessing")?Math.floor(getChargeLevel(defender)/5):0;
      if(dischargeReduction>0){ const reduced=Math.max(1,finalAmount-dischargeReduction); if(reduced!==finalAmount)addLog(`${handNames[defender]}の「放電の加護」により${sourceLabel}が${finalAmount}→${reduced}。`); finalAmount=reduced; }
      const duelReduction = duelSurgeDefense(defender, targetHand);
      if (duelReduction > 0) {
        const reduced = Math.max(1, finalAmount - duelReduction);
        if (reduced !== finalAmount) addLog(`${handNames[defender]}の${handNames[targetHand]}の「決闘高潮」により、${sourceLabel}の本数が${finalAmount}→${reduced}になった。`);
        finalAmount = reduced;
      }
      const kinetic=findAttachmentSlot(defender,targetHand,"kineticConversion");
      if(kinetic&&originalIncoming>0){ gainCharge(defender,originalIncoming,"運動エネルギー変換"); const reduced=Math.max(0,finalAmount-1); addLog(`${handNames[defender]}の「運動エネルギー変換」により${sourceLabel}が${finalAmount}→${reduced}。`); finalAmount=reduced; const slots=state.traps[defender][targetHand]; const idx=slots.indexOf(kinetic); if(idx>=0)slots.splice(idx,1); }
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
          if (predicate(cardId) && isExternallyRemovableAttachment(cardId)) options.push({ owner, hand, index, cardId });
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
      } else if (state.battleMode === "friend") {
        const response = await requestRemoteFriendDecision("magicMirror", { hand, cardId });
        useMirror = !!response?.use;
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
        return state.traps[opponent][hand].some(slot=>isExternallyRemovableAttachment(trapCardId(slot))) &&
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
          if (!isExternallyRemovableAttachment(cardId)) return;
          options.push({ owner, hand, index, cardId });
        });
      }
      if (options.length === 0) return null;
      options.sort((a, b) => (CARD_LIBRARY[b.cardId].cost || 0) - (CARD_LIBRARY[a.cardId].cost || 0));
      return options[0];
    }

    async function discardOneCard(player, reason = "") {
      const candidates=state.hands[player].map((cardId,index)=>({cardId,index})).filter(x=>isExternallyDiscardableHandCard(x.cardId));
      if(!candidates.length) return null;
      const picked=candidates[Math.floor(Math.random()*candidates.length)];
      return await discardHandCardByEffect(player, picked.index, reason);
    }

       function discardEffectPopupText(cardId, player) {
      const opponent = player === "human" ? "cpu" : "human";
      if (cardId === "accelBullet") return "捨てられた時効果：カードを1枚引く。";
      if (cardId === "specialBullet") return `捨てられた時効果：${handNames[opponent]}の手札をランダムに1枚捨てさせる。`;
      if (cardId === "pierceBullet") return `捨てられた時効果：${handNames[opponent]}の設置済み罠をランダムに1枚捨てる。`;
      return "捨てられた時効果が発動しました。";
    }

    async function showDiscardEffectPopup(player, cardId, ms = 900) {
      const card = CARD_LIBRARY[cardId];
      if (!card) return;
      await showPopup(player, `「${card.name}」`, discardEffectPopupText(cardId, player), "card", ms);
    }

    async function handleCardDiscardEffect(player, cardId) {
      const card = CARD_LIBRARY[cardId];
      if (!card?.bullet) return;
      const opponent = player === "human" ? "cpu" : "human";
      const hasDiscardEffect = ["accelBullet", "specialBullet", "pierceBullet", "recoveryBullet", "reducedLoadBullet", "tracerBullet", "dudBullet", "disruptionBullet", "shatterBullet"].includes(cardId);
      if (!hasDiscardEffect) return;

      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        emitFriendFx("discardEffect", {
          playerSide: friendSideForLocalPlayer(player),
          cardId
        }).catch(error => console.error("PVP discard effect fx failed", error));
      }
      await showDiscardEffectPopup(player, cardId, 900);

      if (cardId === "accelBullet") {
        drawCard(player);
        addLog(`${handNames[player]}の「加速弾」効果。1枚引いた。`);
      } else if (cardId === "specialBullet") {
        const discarded = await discardOneCard(opponent);
        addLog(`${handNames[player]}の「特殊弾」効果。${handNames[opponent]}は${discarded ? `「${CARD_LIBRARY[discarded].name}」` : "手札"}を1枚捨てた。`);
      } else if (cardId === "pierceBullet") {
        const removed = removeRandomTrap(opponent);
        addLog(`${handNames[player]}の「貫通弾」効果。${removed ? `${handNames[opponent]}の罠「${CARD_LIBRARY[removed].name}」を捨て札にした。` : `${handNames[opponent]}に罠はなかった。`}`);
      } else if (cardId === "recoveryBullet") {
        const activeIndex = state.discard[player].lastIndexOf(cardId);
        const candidates = state.discard[player]
          .map((id, index) => ({ id, index }))
          .filter(item => item.index !== activeIndex && CARD_LIBRARY[item.id]?.bullet);
        if (candidates.length) {
          const picked = candidates[randomIndex(candidates.length)];
          state.discard[player].splice(picked.index, 1);
          state.decks[player].push(picked.id);
          shuffle(state.decks[player]);
          addLog(`${handNames[player]}の「回収弾」効果。捨て札の「${CARD_LIBRARY[picked.id].name}」を山札へ戻してシャッフルした。`);
        } else addLog(`${handNames[player]}の「回収弾」効果。回収できる別の弾はなかった。`);
      } else if (cardId === "reducedLoadBullet") {
        const eligible = ["L", "R"].filter(hand => state[player][hand] >= 2);
        if (eligible.length) {
          const max = Math.max(...eligible.map(hand => state[player][hand]));
          const targets = eligible.filter(hand => state[player][hand] === max);
          const hand = targets[randomIndex(targets.length)];
          const before = state[player][hand];
          state[player][hand] = Math.max(0, before - 1);
          addLog(`${handNames[player]}の「減装弾」効果。${handNames[hand]}を${before}→${state[player][hand]}。`);
          clearBrokenTraps(player);
        } else addLog(`${handNames[player]}の「減装弾」効果は、2本以上ある手がないため不発。`);
      } else if (cardId === "tracerBullet") {
        const count = Math.min(3, state.decks[player].length);
        const topStart = state.decks[player].length - count;
        const candidates = [];
        for (let index = topStart; index < state.decks[player].length; index++) {
          if (CARD_LIBRARY[state.decks[player][index]]?.bullet) candidates.push(index);
        }
        if (candidates.length) {
          const pickedIndex = candidates[randomIndex(candidates.length)];
          const [picked] = state.decks[player].splice(pickedIndex, 1);
          state.decks[player].push(picked);
          addLog(`${handNames[player]}の「曳光弾」効果。山札上${count}枚から弾を山札の一番上へ移した。`);
        } else addLog(`${handNames[player]}の「曳光弾」効果。山札上${count}枚に弾はなく、順序を維持した。`);
      } else if (cardId === "dudBullet") {
        const index = state.discard[player].lastIndexOf(cardId);
        if (index >= 0) {
          state.discard[player].splice(index, 1);
          state.decks[player].push(cardId);
          shuffle(state.decks[player]);
          addLog(`${handNames[player]}の「不発弾」効果。自身を山札へ戻してシャッフルした。`);
        }
      } else if (cardId === "disruptionBullet") {
        state.pendingStartDrawSkip[opponent] = true;
        addLog(`${handNames[player]}の「阻害弾」効果。${handNames[opponent]}の次の通常ターン開始ドローを封じた。`);
      } else if (cardId === "shatterBullet") {
        const own = await discardRandomCards(player, 2, "「粉砕弾」");
        const enemy = await discardRandomCards(opponent, 2, "「粉砕弾」");
        addLog(`${handNames[player]}の「粉砕弾」効果。${handNames[player]}は${own}枚、${handNames[opponent]}は${enemy}枚捨てた。`);
      }
    }

    function logBulletNormalUse(player, cardId) {
      addLog(`${handNames[player]}は「${CARD_LIBRARY[cardId].name}」を通常使用した。捨て札時効果は発動しない。`);
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

    function getRapidFireDiscardCandidates(player) {
      const excludedIndex = Number.isInteger(state.pendingRapidFireExcludedIndex)
        ? state.pendingRapidFireExcludedIndex
        : null;
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => item.index !== excludedIndex && isExternallyDiscardableHandCard(item.cardId));
    }

    function getGunAmmoCandidates(player, excludedIndex = null) {
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => item.index !== excludedIndex && isExternallyDiscardableHandCard(item.cardId));
    }

    function beginGunAmmoEffect(player, gunCardId) {
      const excludedIndex = state.copiedEffectContext?.sourceLabel === "乱闘" && state.copiedEffectContext?.cardId === gunCardId
        ? Number(state.copiedEffectContext.sourceHandIndex)
        : null;
      const candidates = getGunAmmoCandidates(player, excludedIndex);
      if (!candidates.length) {
        addLog(`${handNames[player]}の「${CARD_LIBRARY[gunCardId].name}」は捨てられる手札がないため不発。`);
        state.pendingTerminalEnd[player] = true;
        return false;
      }
      if (player === "human") {
        state.pendingGunEffect = { player, gunCardId, excludedIndex };
        state.mode = "gunAmmoDiscard";
        setMessage(`「${CARD_LIBRARY[gunCardId].name}」：弾薬として捨てる手札を1枚選んでください。`);
        render();
        return true;
      }
      const picked = [...candidates].sort((a, b) => gunAmmoPower(b.cardId) - gunAmmoPower(a.cardId))[0];
      return resolveGunAmmoEffect(player, gunCardId, picked.index);
    }

    function gunAmmoPower(cardId) {
      const card = CARD_LIBRARY[cardId];
      return (card?.cost || 0) + (card?.bullet ? 1 : 0);
    }

    async function resolveGunAmmoEffect(player, gunCardId, discardIndex) {
      const pending = state.pendingGunEffect;
      const excludedIndex = pending?.player === player && pending?.gunCardId === gunCardId ? pending.excludedIndex : null;
      const selected = getGunAmmoCandidates(player, excludedIndex).find(item => item.index === discardIndex);
      if (!selected) return false;
      const ammoId = selected.cardId;
      const power = gunAmmoPower(ammoId);
      const ammoName = CARD_LIBRARY[ammoId]?.name || ammoId;
      await discardHandCardByEffect(player, discardIndex, `「${CARD_LIBRARY[gunCardId].name}」`);
      state.pendingGunEffect = null;
      state.mode = "attack";

      if (gunCardId === "indiscriminateFire") {
        let bulletproofFxShown = false;
        for (let shot = 0; shot < power; shot++) {
          const targets = [];
          for (const owner of [player, otherPlayer(player)]) {
            for (const hand of ["L", "R"]) if (state[owner][hand] > 0) targets.push({ owner, hand });
          }
          if (!targets.length) break;
          const target = targets[randomIndex(targets.length)];
          if (isBulletproofVestBlocking(target.owner, target.hand, gunCardId)) {
            await blockWithBulletproofVest(target.owner, target.hand, gunCardId, "無差別射撃", !bulletproofFxShown);
            bulletproofFxShown = true;
            continue;
          }
          await addFingersWithCalculation(target.owner, target.hand, 1, "無差別射撃");
        }
        addLog(`${handNames[player]}の「無差別射撃」。「${ammoName}」を捨て、威力${power}でランダム射撃した。`);
      } else if (gunCardId === "shotgun") {
        const amount = Math.floor(power / 2);
        const opponent = otherPlayer(player);
        const targets = ["L", "R"].filter(hand => state[opponent][hand] > 0);
        let bulletproofFxShown = false;
        for (const hand of targets) {
          if (amount > 0 && isBulletproofVestBlocking(opponent, hand, gunCardId)) {
            await blockWithBulletproofVest(opponent, hand, gunCardId, "ショットガン", !bulletproofFxShown);
            bulletproofFxShown = true;
            continue;
          }
          await addFingersWithCalculation(opponent, hand, amount, "ショットガン");
        }
        addLog(`${handNames[player]}の「ショットガン」。「${ammoName}」を捨て、威力${power}（各${amount}本）を生存している相手の手へ加えた。`);
      }
      state.pendingTerminalEnd[player] = true;
      render();
      return true;
    }

    async function chooseGunAmmoDiscard(index) {
      if (state.mode !== "gunAmmoDiscard" || !state.pendingGunEffect) return false;
      const { gunCardId } = state.pendingGunEffect;
      const resolved = await resolveGunAmmoEffect("human", gunCardId, index);
      if (!resolved) {
        setMessage("そのカードは弾薬として捨てられません。別の手札を選んでください。");
        return false;
      }
      if (state.turn === "human" && !state.gameOver) {
        state.pendingTerminalEnd.human = false;
        await endTurn();
      }
      return true;
    }

    function deckGunIds() {
      return Object.keys(CARD_LIBRARY).filter(cardId => CARD_LIBRARY[cardId]?.gun && !CARD_LIBRARY[cardId]?.token);
    }

    function getModulationSourceCandidates(player) {
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => CARD_LIBRARY[item.cardId]?.gun && deckGunIds().some(targetId => targetId !== item.cardId));
    }

    function beginModulation(player) {
      const candidates = getModulationSourceCandidates(player);
      if (!candidates.length) {
        addLog(`${handNames[player]}の「変調」は変化可能な銃が手札にないため不発。`);
        return false;
      }
      if (player === "human") {
        state.pendingModulation = { player };
        state.mode = "modulationSource";
        setMessage("「変調」：変化させる手札の銃カードを選んでください。");
        render();
        return true;
      }
      const source = candidates[randomIndex(candidates.length)];
      const targets = deckGunIds().filter(id => id !== source.cardId);
      return resolveModulation(player, source.index, targets[randomIndex(targets.length)]);
    }

    function resolveModulation(player, handIndex, targetCardId) {
      const sourceId = state.hands[player][handIndex];
      if (!CARD_LIBRARY[sourceId]?.gun || !deckGunIds().includes(targetCardId) || sourceId === targetCardId) return false;
      state.hands[player][handIndex] = targetCardId;
      state.pendingModulation = null;
      state.mode = "attack";
      addLog(`${handNames[player]}の「変調」により「${CARD_LIBRARY[sourceId].name}」が「${CARD_LIBRARY[targetCardId].name}」へ変化した。`);
      render();
      if (state.battleMode === "friend" && player === "human") scheduleFriendStatePublish();
      return true;
    }

    function chooseModulationSource(index) {
      if (state.mode !== "modulationSource") return false;
      const sourceId = state.hands.human[index];
      const targets = deckGunIds().filter(id => id !== sourceId);
      if (!CARD_LIBRARY[sourceId]?.gun || !targets.length) return false;
      const options = targets.map((id, i) => `${i + 1}. ${CARD_LIBRARY[id].name}`).join("\n");
      return chooseModulationSourceV153(index);
      if (!Number.isInteger(picked) || picked < 0 || picked >= targets.length) {
        setMessage("「変調」は変化先が選ばれなかったため不発。");
        state.pendingModulation = null;
        state.mode = "attack";
        render();
        return false;
      }
      return resolveModulation("human", index, targets[picked]);
    }

    async function chooseModulationSourceV153(index) {
      if (state.mode !== "modulationSource") return false;
      const sourceId = state.hands.human[index];
      const targets = deckGunIds().filter(id => id !== sourceId);
      if (!CARD_LIBRARY[sourceId]?.gun || !targets.length) return false;
      const chosen = await showGameChoicePanel({
        title: "変調：変化先を選択",
        message: `「${CARD_LIBRARY[sourceId].name}」とは異なる銃を選んでください。`,
        choices: targets.map(id => ({ key: id, id }))
      });
      return chosen ? resolveModulation("human", index, chosen.key) : false;
    }

    async function beginFanning(player) {
      const bulletIndexes = state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => CARD_LIBRARY[item.cardId]?.bullet && isExternallyDiscardableHandCard(item.cardId))
        .map(item => item.index);
      const fixedCount = bulletIndexes.length;
      await discardFixedHandCardsByEffect(player, bulletIndexes, "「ファニング」");
      const shots = Math.min(fixedCount, 6);
      const opponent = otherPlayer(player);
      const targets = ["L", "R"].filter(hand => state[opponent][hand] > 0);
      if (shots <= 0 || !targets.length) {
        addLog(`${handNames[player]}の「ファニング」は弾${fixedCount}枚を捨て、${shots}回射撃した。`);
        state.pendingTerminalEnd[player] = true;
        return true;
      }
      if (player === "human") {
        state.pendingFanning = { player, shots };
        state.mode = "fanningTarget";
        setMessage(`「ファニング」：${shots}回射撃する相手の0ではない手を選んでください。`);
        render();
        return true;
      }
      return resolveFanning(player, targets[randomIndex(targets.length)], shots);
    }

    async function resolveFanning(player, initialHand, shots) {
      const opponent = otherPlayer(player);
      let targetHand = initialHand;
      let fired = 0;
      let bulletproofFxShown = false;
      for (; fired < shots; fired++) {
        if (state[opponent][targetHand] <= 0) {
          const alternate = otherHand(targetHand);
          if (state[opponent][alternate] <= 0) break;
          targetHand = alternate;
        }
        if (isBulletproofVestBlocking(opponent, targetHand, "fanning")) {
          await blockWithBulletproofVest(opponent, targetHand, "fanning", "ファニング", !bulletproofFxShown);
          bulletproofFxShown = true;
          continue;
        }
        await addFingersWithCalculation(opponent, targetHand, 1, "ファニング");
      }
      state.pendingFanning = null;
      state.mode = "attack";
      state.pendingTerminalEnd[player] = true;
      addLog(`${handNames[player]}の「ファニング」は${fired}回射撃した。`);
      render();
      return true;
    }

    function chooseCpuRapidFireDiscardIndex(player = "cpu") {
      const candidates = getRapidFireDiscardCandidates(player);
      if (!candidates.length) return -1;
      let bestIndex = -1;
      let bestScore = -1;
      candidates.forEach(({ cardId, index }) => {
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

    function hasBulletproofVest(player, hand) {
      return hasAttachment(player, hand, "bulletproofVest");
    }

    function canBulletproofVestBlockSource(sourceCardId) {
      return sourceCardId === "snipe" || !!CARD_LIBRARY[sourceCardId]?.gun;
    }

    function isBulletproofVestBlocking(player, hand, sourceCardId) {
      return hasBulletproofVest(player, hand) && canBulletproofVestBlockSource(sourceCardId);
    }

    async function blockWithBulletproofVest(defender, targetHand, sourceCardId, sourceName, showFx = true) {
      if (!isBulletproofVestBlocking(defender, targetHand, sourceCardId)) return false;
      if (showFx) await triggerBulletproofBlockedFx(defender, sourceName);
      addLog(`${handNames[defender]}の${handNames[targetHand]}にある「防弾チョッキ」が「${sourceName}」を防いだ。`);
      return true;
    }

    async function showBulletproofBlockedPopup(defender, sourceName, ms = 900) {
      await showPopup(
        defender,
        "「防弾チョッキ」",
        `${sourceName}による遠距離ダメージを防いだ。`,
        "card",
        ms
      );
    }

    async function triggerBulletproofBlockedFx(defender, sourceName) {
      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        emitFriendFx("bulletproofBlocked", {
          playerSide: friendSideForLocalPlayer(defender),
          sourceName
        }).catch(error => console.error("PVP bulletproof fx failed", error));
      }
      await showBulletproofBlockedPopup(defender, sourceName, 900);
    }

    async function applySnipe(player, defender, targetHand) {
      if (state[defender][targetHand] <= 0) return false;
      if (await blockWithBulletproofVest(defender, targetHand, "snipe", "狙撃")) {
        if (player === "human") {
          state.mode = "attack";
          setMessage(`「狙撃」は「防弾チョッキ」に防がれました。まだ攻撃か分けるができます。`);
        }
        render();
        return true;
      }
      const before = state[defender][targetHand];
      const amount = applyGuardBlessingReduction(defender, targetHand, 1, "狙撃");
      const total = before + amount;
      const finalValue = normalize(total, defender, targetHand);
      await animateCalculation(defender, targetHand, total, finalValue);
      state[defender][targetHand] = finalValue;
      addLog(`${handNames[player]}は「狙撃」で${handNames[defender]}の${handNames[targetHand]}に${amount}本加えた。${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      setLastAction(player, "狙撃", `${handNames[defender]}の${handNames[targetHand]}を+1しました。`, "card");
      clearBrokenTraps(defender);
      render();
      if (state.battleMode === "friend" && player === "human") {
        await emitFriendFx("attackResult", {
          defenderSide: friendSideForLocalPlayer(defender),
          targetHand,
          total,
          finalValue,
          source: "狙撃"
        });
        await forcePublishFriendStateNow("snipe result");
      }
      if (checkWin()) return true;
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
      if (!isExternallyRemovableAttachment(cardId)) {setMessage("そのカードは外部効果で移動できません。");return false;}
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

    function attachmentKindInfo(card, options = {}) {
      if (card?.blessing) return { label: "加護", symbol: "✦", className: "blessing" };
      if (card?.curse) return { label: "呪縛", symbol: "◆", className: "curse" };
      if (options.publiclyRevealed) return { label: "公開済み罠", symbol: "⚠", className: "trap" };
      return { label: "罠", symbol: "▣", className: "own-trap" };
    }

    function openAttachmentDetail(cardId, options = {}) {
      const card = CARD_LIBRARY[cardId];
      if (!card || !elements.attachmentDetailModal) return;
      const info = attachmentKindInfo(card, options);
      elements.attachmentDetailKind.textContent = `${info.symbol} ${info.label}`;
      elements.attachmentDetailKind.className = `attachment-detail-kind ${info.className}`;
      elements.attachmentDetailName.textContent = card.name;
      elements.attachmentDetailMeta.textContent = `コスト${card.cost} / ${card.type}`;
      if (cardId === "duelSurge" && options.slot) {
        const level = Number(options.slot.level) || 0;
        const stats = duelSurgeStats(level);
        const target = options.slot.duelTargetHand
          ? `${options.slot.duelTargetOwner === options.owner ? "自分" : "相手"}の${handNames[options.slot.duelTargetHand]}`
          : "未決定";
        elements.attachmentDetailName.textContent = `${card.name} Lv.${level}`;
        elements.attachmentDetailText.textContent =
          `記録対象：${target}\n現在の効果：与える本数+${stats.attack} / 受ける本数-${stats.defense}\n` +
          `同じ対象を攻撃するとLv.${Math.min(5, level + 1)}。別の対象を攻撃するとLv.1。最大Lv.5。`;
      } else {
        elements.attachmentDetailText.textContent = cardId === "harpoon"
          ? `${card.text}\n\n【銛とは】\n銛は設置ゾーンへ置く生成呪縛です。通常攻撃が最終的に命中するたび振動+1、同じターンの最初の命中時だけ攻撃側が1枚引きます。移動しても状態を保持し、回収時だけ現在位置へ振動分を加えます。解呪など通常除去では振動は発動せず、各プレイヤーは自分の銛を1本まで所有できます。`
          : card.text;
      }
      elements.attachmentDetailModal.classList.add("show");
    }

    function closeAttachmentDetail() {
      elements.attachmentDetailModal?.classList.remove("show");
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
          const justiceReveal = isTrap && (
            (player === "cpu" && hasMagicalJustice("human")) ||
            (player === "human" && hasMagicalJustice("cpu"))
          );
          const hidden = isTrap && player === "cpu" && !revealed && !exposedByCurse && !justiceReveal;
          const publiclyRevealed = isTrap && player === "cpu" && !hidden;
          const ownVisibleTrap = isTrap && player === "human";
          div.className =
            "trap-slot filled" +
            (hidden ? " cpu-hidden" : "") +
            (publiclyRevealed ? " revealed-trap-slot" : "") +
            (ownVisibleTrap ? " own-trap-slot" : "") +
            (card?.blessing ? " blessing-slot" : "") +
            (card?.magicalTransformed ? ` magical-transformed-slot magical-${card.magicalColor}` : "") +
            (card?.curse ? " curse-slot" : "") +
            (cardId === "harpoon" ? " harpoon-slot" : "") +
            (selectable ? " selectable-trap-card" : "");
          const kindInfo = attachmentKindInfo(card, { publiclyRevealed });
          const displayName = cardId === "duelSurge" ? `${card.name} Lv.${Number(slot?.level) || 0}` : cardId === "harpoon" ? `銛-振動:${Math.max(0,Number(slot?.vibration)||0)}` : card.name;
          div.textContent = hidden ? `伏せ${i + 1}` : `${kindInfo.symbol} ${displayName}`;
          div.title = hidden ? "伏せカード" : `${kindInfo.label}「${displayName}」：${card.text}`;

          if (selectable) {
            div.title = "このカードを選ぶ";
            div.addEventListener("click", (event) => {
              event.stopPropagation();
              if (state.mode === "chooseOwnCurse") chooseOwnCurseSlot(player, hand, i);
              else if (state.mode === "swapOpponentAttachment" || state.mode === "swapOwnAttachment") chooseSwapAttachmentSlot(player, hand, i);
              else chooseOpponentTrapSlot(player, hand, i);
            });
          } else if (!hidden) {
            div.classList.add("detail-openable");
            div.addEventListener("click", (event) => {
              event.stopPropagation();
              openAttachmentDetail(cardId, { publiclyRevealed, slot, owner: player, hand });
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

    function directiveCardTextHtml(cardId, card) {
      if (!card?.directive) return escapeHtml(card.text);
      const base = directiveBaseId(cardId);
      const data = card.directiveData || {};
      const reinterpreted=data.reinterpreted?'<div class="directive-note">再解釈済み</div>':'';

      if (base === "directiveAttack") {
        return `<div class="directive-summary">
          <span class="directive-label">指定</span>
          <span class="directive-hand">${escapeHtml(directiveHandLabel(data.attackHand))}</span>
          <span class="directive-action">手で攻撃</span>
        </div>
        <div class="directive-note">通常攻撃で達成可能</div>${reinterpreted}
        <div class="directive-result"><strong>達成</strong> 次の指定手の攻撃+1</div>
        <div class="directive-result fail"><strong>未達成</strong> 次の指定手の攻撃-1</div>`;
      }

      if (base === "directiveTarget") {
        return `<div class="directive-summary">
          <span class="directive-label">指定</span>
          <span class="directive-hand">${escapeHtml(directiveHandLabel(data.attackHand))}</span>
          <span class="directive-arrow">→</span>
          <span class="directive-target">${escapeHtml(directiveHandLabel(data.targetHand))}手</span>
        </div>
        <div class="directive-note">通常攻撃で達成可能</div>${reinterpreted}
        <div class="directive-result"><strong>達成</strong> 1枚引く</div>
        <div class="directive-result fail"><strong>未達成</strong> 指定した自分の手+1</div>`;
      }

      if (base === "directiveSilence") {
        return `<div class="directive-summary">
          <span class="directive-label">条件</span>
          <span class="directive-keyword">カード使用禁止</span>
        </div>
        <div class="directive-result"><strong>達成</strong> 3枚引く</div>
        <div class="directive-result fail"><strong>未達成</strong> 次の自分ターン、カード使用不可</div>`;
      }

      if (base === "directiveReform") {
        return `<div class="directive-summary">
          <span class="directive-label">条件</span>
          <span class="directive-keyword">分ける</span>
        </div>
        <div class="directive-result"><strong>達成</strong> 次の自分ターン、最初に分けた後も続行</div>
        <div class="directive-result fail"><strong>未達成</strong> 次の自分ターン、分ける不可</div>`;
      }

      if(base==="directiveAnnihilation")return `<div class="directive-summary"><span class="directive-label">条件</span><span class="directive-keyword">相手の手を0にする</span></div><div class="directive-result"><strong>達成</strong> 次ターン、相手への加算が7以上なら0</div><div class="directive-result fail"><strong>未達成</strong> 次の攻撃-1</div>`;
      if(base==="directiveCombo")return `<div class="directive-summary"><span class="directive-label">条件</span><span class="directive-keyword">攻撃を2回以上行う</span></div><div class="directive-result"><strong>達成</strong> 次ターンの攻撃回数+1</div><div class="directive-result fail"><strong>未達成</strong> 次ターンの攻撃回数-1（最低0）</div>`;
      if(base==="directiveConstant")return `<div class="directive-summary"><span class="directive-label">指定</span><span class="directive-keyword">相手の手に${Number(data.value)||1}がある</span></div>${reinterpreted}<div class="directive-result"><strong>達成</strong> 2枚引く</div><div class="directive-result fail"><strong>未達成</strong> 相手の生存手1つを${Number(data.value)||1}へ1近づける</div>`;

      return escapeHtml(card.text);
    }

    async function showHandCardDetails(cardId) {
      const card = CARD_LIBRARY[cardId];
      if (!card) return;
      const text = card.directive ? directiveCardTextHtml(cardId, card) : escapeHtml(card.text);
      const body =
        `<div class="long-press-card-type">${escapeHtml(card.type)}</div>` +
        `<div class="long-press-card-cost">コスト ${card.cost}</div>` +
        `<div class="long-press-card-effect">${text}</div>`;
      await showPopup("human", `「${card.name}」`, body, "card-detail", 1800, true);
    }

    function attachCardLongPress(div, cardId) {
      let timer = null;
      let longPressed = false;
      let startX = 0;
      let startY = 0;

      const clearTimer = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      div.addEventListener("pointerdown", event => {
        if (!displaySettings.compactCardDescriptions) return;
        if (event.button !== undefined && event.button !== 0) return;
        startX = event.clientX;
        startY = event.clientY;
        longPressed = false;
        clearTimer();
        timer = setTimeout(async () => {
          timer = null;
          longPressed = true;
          div.classList.add("long-press-active");
          try {
            if (navigator.vibrate) navigator.vibrate(35);
          } catch {}
          await showHandCardDetails(cardId);
          div.classList.remove("long-press-active");
        }, 550);
      });

      div.addEventListener("pointermove", event => {
        if (timer === null) return;
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) {
          clearTimer();
        }
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
        div.addEventListener(type, clearTimer);
      });

      div.addEventListener("contextmenu", event => {
        if (displaySettings.compactCardDescriptions) event.preventDefault();
      });

      div.addEventListener("click", event => {
        if (!longPressed) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressed = false;
      }, true);
    }

    function renderHumanCards() {
      normalizeDirectiveCardsInHand("human");
      normalizeChargeHand("human");
      elements.humanCards.innerHTML = "";
      const directiveClears = Math.max(0, Number(state.directiveTotalClears?.human || 0));
      if (elements.directiveClearBadge) {
        elements.directiveClearBadge.hidden = directiveClears < 1;
        elements.directiveClearBadge.textContent = directiveClears > 0 ? `CLEAR ×${directiveClears}` : "";
      }

      if (state.hands.human.length === 0) {
        elements.humanCards.innerHTML = `<p class="small">手札はありません。</p>`;
        return;
      }

      state.hands.human.forEach((cardId, index) => {
        const effectiveCardId = effectiveCardIdForPlayer("human", cardId);
        const card = CARD_LIBRARY[effectiveCardId];
        const isTrap = !!card.trap;
        const isZoneCard = !!(card.trap || card.blessing || card.curse);
        const setupActive = state.turn === "human" && !state.gameOver && !state.animating && state.temp.human.setupMode;
        const repairDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "repairDiscard";
        const calmDownDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "calmDownDiscard";
        const rapidFireDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "rapidFireDiscard";
        const gunAmmoDiscardMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "gunAmmoDiscard";
        const modulationSourceMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "modulationSource";
        const handCardSelectionMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "handCardSelection";
        const boardOrNumberSelectionMode = state.mode === "boardHandSelection" || state.mode === "numberAllocation";
        const cityWillMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "cityWillChoose";
        const advanceNoticeMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "advanceNoticeChoose";
        const restrictedByCost = state.activeCostLimit.human !== null && card.cost > state.activeCostLimit.human;
        const berserkLocked = state.berserkerTurns.human > 0 && !state.temp.human.berserkerJustUsed;
        const intemperanceLocked = !!state.activeIntemperanceCardLock?.human;
        const romanRuleLocked = !canUseCardUnderRule("human",cardId,{silent:true});
        const baseCardActionAvailable =
          state.turn === "human" &&
          !state.gameOver &&
          !state.animating &&
          (!state.temp.human.cardActionUsed || Number(state.temp.human.cardExtraUses || 0) > 0 || card.consumesCardAction===false) &&
          !berserkLocked &&
          !intemperanceLocked;
        const lightSpeedChargePlayable =
          state.turn === "human" &&
          !state.gameOver &&
          !state.animating &&
          !berserkLocked &&
          !intemperanceLocked &&
          canUseChargeCardDuringLightSpeed("human", cardId);
        const chargeCardAvailableThisTurn = canUseChargeCardThisTurn("human", cardId);
        const canUseCardAction = (baseCardActionAvailable || lightSpeedChargePlayable) && chargeCardAvailableThisTurn;
        const normalPlayable =
          !repairDiscardMode &&
          !calmDownDiscardMode &&
          !rapidFireDiscardMode &&
          !gunAmmoDiscardMode &&
          !modulationSourceMode &&
          !handCardSelectionMode &&
          !boardOrNumberSelectionMode &&
          !cityWillMode &&
          !advanceNoticeMode &&
          !romanRuleLocked &&
          !restrictedByCost &&
          (!state.forcedCard?.human?.active || handCardInstanceId("human",index)===state.forcedCard.human.instanceId) &&
          canUseCardAction &&
          !isZoneCard &&
          card.canPlay("human");
        const trapPlayable =
          !repairDiscardMode &&
          !calmDownDiscardMode &&
          !rapidFireDiscardMode &&
          !gunAmmoDiscardMode &&
          !modulationSourceMode &&
          !handCardSelectionMode &&
          !boardOrNumberSelectionMode &&
          !cityWillMode &&
          !advanceNoticeMode &&
          !romanRuleLocked &&
          !restrictedByCost &&
          !berserkLocked &&
          !intemperanceLocked &&
          (((baseCardActionAvailable || lightSpeedChargePlayable) && isZoneCard && !setupActive) || (setupActive && isTrap)) &&
          canSetAttachmentTarget("human", cardId);
        const discardPlayable = repairDiscardMode && cardId !== "repair" && isExternallyDiscardableHandCard(cardId);
        const calmDiscardPlayable = calmDownDiscardMode && cardId !== "calmDown" && isExternallyDiscardableHandCard(cardId);
        const rapidDiscardPlayable = rapidFireDiscardMode && getRapidFireDiscardCandidates("human").some(item => item.index === index);
        const gunAmmoPlayable = gunAmmoDiscardMode && state.pendingGunEffect && getGunAmmoCandidates("human", state.pendingGunEffect.excludedIndex).some(item => item.index === index);
        const modulationPlayable = modulationSourceMode && CARD_LIBRARY[cardId]?.gun && deckGunIds().some(id => id !== cardId);
        const handCardSelectable = handCardSelectionMode && !!pendingHandCardSelection?.eligible.has(index);
        const handCardSelected = handCardSelectionMode && !!pendingHandCardSelection?.selected.has(index);
        const cityWillPlayable = cityWillMode && isDirectiveCard(cardId);
        const advanceNoticePlayable = advanceNoticeMode && getAdvanceNoticeCandidates("human").some(item => item.index === index);
        const performanceEvolved =
          getPerformanceLevel("human") >= PERFORMANCE_EVOLUTION_LEVEL &&
          PERFORMANCE_LV5_EVOLUTION_MAP[cardId] === effectiveCardId;
        const rondoUnused =
          state.selectedTheme?.human === "rondo" &&
          !!card?.rondo &&
          effectiveCardId !== "performance" &&
          !(state.usedRondoCards?.human || []).includes(effectiveCardId);
        const selected = state.selectedTrapCardIndex === index;
        const div = document.createElement("div");
        div.className =
          "game-card" +
          (card.blessing ? " blessing-card" : "") +
          (card.curse ? " curse-card" : "") +
          (card.directive ? " directive-card" : "") +
          (card.magicalEvolution ? " magical-evolution-card" : "") +
          (performanceEvolved ? " performance-evolved-card" : "") +
          (normalPlayable ? " playable" : "") +
          (trapPlayable ? " trap-playable" : "") +
          (discardPlayable || calmDiscardPlayable || rapidDiscardPlayable || gunAmmoPlayable || modulationPlayable || cityWillPlayable || advanceNoticePlayable || handCardSelectable ? " playable" : "") +
          (selected || handCardSelected ? " selected-card" : "") +
          (displaySettings.compactCardDescriptions ? " compact-description-card" : "");
        div.innerHTML = `
          ${rondoUnused ? '<span class="rondo-unused-mark" aria-label="未使用の輪舞曲" title="初使用の輪舞曲">♪</span>' : ''}
          <div class="card-title">
            <span class="card-name">${escapeHtml(cardId === "performance" ? `演舞${performanceLevelLabel(getPerformanceLevel("human"))}` : card.name)}</span>
          </div>
          <div class="card-label-row">
            <span class="card-type${isTrap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
          </div>
          <div class="card-cost">コスト ${card.cost}</div>
          ${displaySettings.compactCardDescriptions
            ? '<div class="card-long-press-hint">長押しで効果を表示</div>'
            : `<div class="card-text">${cardId === "magicalChant" && effectiveCardId === "magicalChant" ? `<strong>詠唱進捗：${Number(state.magicalChantProgress?.human || 0)}/3</strong><br>${escapeHtml(card.text)}` : card.directive ? directiveCardTextHtml(cardId, card) : escapeHtml(card.text)}</div>`}
          ${romanRuleLocked ? '<div class="used">準備時間中使用不可</div>' : advanceNoticePlayable ? '<div class="used">予告状：公開して予約</div>' : cityWillPlayable ? '<div class="used">都市の意志：相手に渡す</div>' : discardPlayable ? '<div class="used">補修：このカードを捨てる</div>' : calmDiscardPlayable ? '<div class="used">落ち着ける：このカードを捨てる</div>' : rapidDiscardPlayable ? '<div class="used">乱射：このカードを捨てる</div>' : gunAmmoPlayable ? '<div class="used">銃：このカードを弾薬にする</div>' : modulationPlayable ? '<div class="used">変調：この銃を変化させる</div>' : intemperanceLocked ? `<div class="used">${escapeHtml(getCardUseLockDisplayText("human"))}</div>` : restrictedByCost ? '<div class="used">倹約令：使用不可</div>' : berserkLocked ? '<div class="used">バーサーカー中：使用不可</div>' : state.temp.human.setupMode && isTrap ? '<div class="used">仕込み中：設置可能</div>' : cardId === "lightSpeedCircuit" && state.lightSpeedCircuitUsed.human
            ? '<div class="used charge-match-used">光速回路はこの試合で発動済み</div>'
            : hasUsedChargeCardThisTurn("human", cardId)
              ? '<div class="used charge-once-used">この充電カードは今ターン使用済み</div>'
            : state.temp.human.cardActionUsed
              ? (lightSpeedChargePlayable
                  ? '<div class="used charge-ready">光速回路：充電カード使用可能</div>'
                  : Number(state.temp.human.cardExtraUses || 0) > 0
                    ? `<div class="used charge-ready">黄金狂：追加使用 残り${Number(state.temp.human.cardExtraUses || 0)}回</div>`
                    : '<div class="used">カード関連行動は使用済み</div>')
              : ''}
        `;
        attachCardLongPress(div, effectiveCardId);
        if (discardPlayable) {
          div.addEventListener("click", () => chooseRepairDiscard(index));
        }
        if (calmDiscardPlayable) {
          div.addEventListener("click", () => chooseCalmDownDiscard(index));
        }
        if (rapidDiscardPlayable) {
          div.addEventListener("click", () => chooseRapidFireDiscard(index));
        }
        if (gunAmmoPlayable) {
          div.addEventListener("click", () => chooseGunAmmoDiscard(index));
        }
        if (modulationPlayable) {
          div.addEventListener("click", () => chooseModulationSourceV153(index));
        }
        if (handCardSelectable) {
          div.addEventListener("click", () => toggleHandCardSelection(index));
        }
        if (cityWillPlayable) {
          div.addEventListener("click", () => transferDirective("human", index));
        }
        if (advanceNoticePlayable) {
          div.addEventListener("click", () => chooseAdvanceNoticeCard("human", index));
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
          <h3>山札切れと疲労</h3>
          <ul>
            <li>山札が0枚の状態でカードを引こうとするたび、「疲労」を1回受けます。</li>
            <li>手札がある場合、手札をランダムに1枚捨てます。</li>
            <li>手札がない場合、自分の0ではない手をランダムに1つ選び、その本数を1減らします。</li>
            <li>複数枚引く効果では、引こうとした枚数だけ疲労を繰り返します。</li>
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

      if (tab === "attachments") {
        const blessings = Object.entries(CARD_LIBRARY)
          .filter(([, card]) => card.blessing)
          .map(([, card]) => `
            <div class="help-card help-attachment-card blessing-help-card">
              <div class="help-card-title">
                <span>${escapeHtml(card.name)}</span>
                <span class="help-badges">
                  <span class="help-badge blessing">加護</span>
                  <span class="help-badge cost">コスト${card.cost}</span>
                </span>
              </div>
              <div class="card-text">${escapeHtml(card.text)}</div>
            </div>
          `).join("");

        const curses = Object.entries(CARD_LIBRARY)
          .filter(([, card]) => card.curse)
          .map(([, card]) => `
            <div class="help-card help-attachment-card curse-help-card">
              <div class="help-card-title">
                <span>${escapeHtml(card.name)}</span>
                <span class="help-badges">
                  <span class="help-badge curse">呪縛</span>
                  <span class="help-badge cost">コスト${card.cost}</span>
                </span>
              </div>
              <div class="card-text">${escapeHtml(card.text)}</div>
            </div>
          `).join("");

        elements.helpBody.innerHTML = `
          <h3>加護とは</h3>
          <ul>
            <li>自分の0でない手に<strong>表向き</strong>で設置するカードです。</li>
            <li>設置された手に継続的な強化や特殊効果を与えます。</li>
            <li>罠と同じ2枠の設置ゾーンを使います。</li>
            <li>その手が0になった場合、その手にある加護は捨て札になります。</li>
          </ul>
          <div class="help-note attachment-legend blessing-legend">
            盤面では<strong>緑色</strong>で「加護｜カード名」と表示されます。伏せ情報ではないため、相手にもカード名が見えます。
          </div>
          <div class="help-card-list">${blessings}</div>

          <h3 class="help-section-gap">呪縛とは</h3>
          <ul>
            <li>相手の0でない手に<strong>表向き</strong>で設置するカードです。</li>
            <li>設置された手を弱体化したり、行動や計算へ特殊な制限を与えます。</li>
            <li>罠・加護と同じ2枠の設置ゾーンを使います。</li>
            <li>その手が0になった場合、その手にある呪縛は捨て札になります。</li>
          </ul>
          <div class="help-note attachment-legend curse-legend">
            盤面では<strong>赤紫色</strong>で「呪縛｜カード名」と表示されます。伏せ情報ではないため、相手にもカード名が見えます。
          </div>
          <div class="help-card-list">${curses}</div>

          <h3 class="help-section-gap">罠との違い</h3>
          <div class="help-note">
            罠は基本的に伏せて設置し、条件を満たした時に発動します。加護と呪縛は最初から表向きで、設置中ずっと効果や条件を持ちます。看破などで公開された罠は<strong>紫色</strong>で表示され、加護・呪縛とは色で区別できます。
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
            <li>デッキはちょうど20枚必要です。19枚以下・21枚以上では対戦できません。</li>
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

    function isNormalAttackActionForbidden(player) {
      return !!state.wholeRestActive?.[player] ||
        !!state.furiosoSkipActive?.[player] ||
        (state.temp[player]?.multiAttackSource === "Furioso" && Number(state.temp[player]?.attackLimit) === 0);
    }

    function canUseNormalAttackAction(player) {
      if (isNormalAttackActionForbidden(player)) return false;
      if (!["L", "R"].some(hand => isAlive(player, hand))) return false;
      if (!["L", "R"].some(hand => isAlive(otherPlayer(player), hand))) return false;
      const temp = state.temp[player] || {};
      return Number(temp.attacksUsed || 0) < Number(temp.attackLimit ?? 1) || !!state.activeExtraAction?.[player];
    }

    function canUseSplitAction(player) {
      return !state.noSplit?.[player] && Number(state.berserkerTurns?.[player] || 0) <= 0 && getSplitOptions(player).length > 0;
    }

    function consumeActiveExtraAction(player) {
      if (!state.activeExtraAction?.[player]) return false;
      state.activeExtraAction[player] = false;
      state.extraActions[player] = Math.max(0, Number(state.extraActions[player] || 0) - 1);
      if (state.temp?.[player]) state.temp[player].extraActionJustConsumed = true;
      return true;
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

    async function applyMoveOne(player, from) {
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
      if (player === "human") await forcePublishFriendStateNow("move one");
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

    function consumeCardActionAllowance(player, { setupActive = false, lightSpeedChargePlayable = false } = {}) {
      if (setupActive) return;
      const temp = state.temp[player];
      if (!temp.cardActionUsed) {
        temp.cardActionUsed = true;
        return;
      }
      if (!lightSpeedChargePlayable && Number(temp.cardExtraUses || 0) > 0) {
        temp.cardExtraUses = Math.max(0, Number(temp.cardExtraUses || 0) - 1);
      }
    }

    function selectTrapCard(index) {
      if ((state.judgmentPrisonTurns?.human || 0) > 0) { setMessage("「懲役」により、このターンはカードを使用できません。"); return; }
      const rawCardId = state.hands.human[index];
      const cardId = effectiveCardIdForPlayer("human", rawCardId);
      const card = CARD_LIBRARY[cardId];
      if (!canUseCardUnderRule("human", cardId)) return false;
      // 設置カードでも控訴・上告による同名使用禁止を確認する。
      // 以前は未定義の player を参照して例外が発生し、設置系カードが反応しなくなっていた。
      if (Array.isArray(state.temp.human?.terminalCardBanIds) && state.temp.human.terminalCardBanIds.includes(cardId)) {
        setMessage(`「${card?.name || "このカード"}」は控訴・上告により、このターン再使用できません。`);
        return false;
      }

      if (isTutorialBattle() && tutorial.expected !== `card:${cardId}`) {
        setMessage("今は黄色く光っているカードだけを使ってください。");
        return;
      }
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed("human", cardId);
      if (!canUseChargeCardThisTurn("human", cardId)) {
        setMessage(`「${card?.name || "このカード"}」はこのターンすでに使用しています。`);
        return;
      }
      if (
        !card ||
        !isAttachmentCard(cardId) ||
        (state.temp.human.cardActionUsed && Number(state.temp.human.cardExtraUses||0)<=0 && !state.temp.human.setupMode && !lightSpeedChargePlayable)
      ) return;
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
      elements.andanteBox?.classList.remove("active");
      const target = card.curse ? "相手の手" : "自分の手";
      setMessage(`「${card.name}」を設置する${target}を選んでください。`);
      render();

      // 設置カードは「カードを選ぶ」→「置く手を選ぶ」の二段階。
      // カード選択画面になった時点で、手を選ぶステップへ進める。
      if (isTutorialBattle() && tutorial.expected === `card:${cardId}`) {
        tutorial.step++;
        renderRealTutorialStep();
      }
    }

    async function setTrap(player, hand, handIndex, owner = player) {
      if(state.startingRouletteActive)return false;
      if(state.quarterRestActive?.[player]){if(player==="human")setMessage("4分休符により、このターンは手札からカードを使用できません。");return false;}
      const cardId = state.hands[player][handIndex];
      const card = CARD_LIBRARY[cardId];
      if (!card || !isAttachmentCard(cardId)) return false;
      if(!canUseCardUnderRule(player,cardId,{silent:player!=="human"}))return false;
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
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed(player, cardId);
      if (!canUseChargeCardThisTurn(player, cardId)) {
        if (player === "human") setMessage(`「${card.name}」はこのターンすでに使用しています。`);
        return false;
      }
      if (
        state[owner][hand] <= 0 ||
        state.traps[owner][hand].length >= 2 ||
        (state.temp[player].cardActionUsed && Number(state.temp[player].cardExtraUses||0)<=0 && !setupActive && !lightSpeedChargePlayable)
      ) return false;
      if (card.blessing && hasSealCurse(owner, hand)) {
        if (player === "human") setMessage("封印の呪縛により、その手には新たに加護を置けません。");
        return false;
      }

      state.hands[player].splice(handIndex, 1);
      markChargeCardUsedThisTurn(player, cardId);
      if (state.temp[player].directiveActions) state.temp[player].directiveActions.cardUsed = true;
      if (card.curse && await maybeReflectCurseWithMagicMirror(player, owner, hand, cardId)) {
        if (!setupActive) {
          consumeCardActionAllowance(player, { lightSpeedChargePlayable });
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
        consumeCardActionAllowance(player, { lightSpeedChargePlayable });
        state.mode = "attack";
      } else {
        state.mode = "setupTrap";
      }
      state.selectedTrapCardIndex = null;

      const label = attachmentLabel(cardId);
      const faceText = card.trap ? "伏せた" : "表向きで置いた";
      if (card.trap) {
        // 共有ログは両者に同期されるため、伏せ罠のカード名は絶対に記録しない。
        addLog(`${handNames[player]}は${handNames[owner]}の${handNames[hand]}の下に罠カードを1枚伏せた。`);
        setLastAction(player, "罠を設置", `${handNames[owner]}の${handNames[hand]}の下に罠カードを1枚伏せた。`, "trap");
      } else {
        addLog(`${handNames[player]}は${handNames[owner]}の${handNames[hand]}の下に${label}「${card.name}」を${faceText}。`);
        setLastAction(player, `${label}を設置`, `${handNames[owner]}の${handNames[hand]}の下に「${card.name}」を${faceText}。`, "card");
      }
      if (player === "human") {
        if (setupActive) {
          setMessage(`「${card.name}」を${handNames[hand]}の下に伏せました。続けて罠を伏せるか、「仕込み終了」を押してください。`);
        } else {
          setMessage(`「${card.name}」を${handNames[owner]}の${handNames[hand]}の下に${faceText}。`);
        }
      }
      triggerChemicalGeneration(player, cardId);
      recordRondoUse(player,cardId);
      render();

      // 罠・加護・呪縛は、対象の手を選んで設置できた後に
      // tutorialAfterHandClick 側で次のステップへ進む。

      // 罠・加護・呪縛の設置は相手側の表示に直結するため、オンラインでは即時同期する。
      if (state.battleMode === "friend" && player === "human" && !state.friendApplyingRemoteState) {
        await publishFriendStateNow();
      }
      return true;
    }

    function terminalAppealChoices(player) {
      if (isRomanPreparation()) return [];
      const choices = [];
      for (const id of ["supremeAppeal", "appeal"]) {
        const index = state.hands[player].indexOf(id);
        if (index >= 0) choices.push({ cardId: id, index });
      }
      return choices;
    }

    function transformRemainingAppeals(player) {
      const transform = zone => {
        for (let i = 0; i < zone.length; i++) if (zone[i] === "appeal") zone[i] = "supremeAppeal";
      };
      transform(state.hands[player]);
      transform(state.decks[player]);
      transform(state.discard[player]);
    }

    function discardAllRemainingSupremeAppeals(player) {
      let count = 0;
      for (const zoneName of ["hands", "decks"]) {
        const zone = state[zoneName][player];
        for (let i = zone.length - 1; i >= 0; i--) {
          if (zone[i] !== "supremeAppeal") continue;
          zone.splice(i, 1);
          state.discard[player].push("supremeAppeal");
          count += 1;
        }
      }
      return count;
    }

    async function askHumanTerminalAppeal(defender, terminalCard) {
      const choices = terminalAppealChoices(defender);
      if (!choices.length) return null;
      return await new Promise(resolve => {
        elements.trapChoiceList.innerHTML = "";
        elements.trapChoiceText.textContent = `相手が終端カード「${terminalCard.name}」を使用しました。割り込みますか？`;
        const cleanup = () => {
          elements.trapChoice.classList.remove("show");
          elements.trapSkipBtn.onclick = null;
        };
        for (const choice of choices) {
          const card = CARD_LIBRARY[choice.cardId];
          const div = document.createElement("div");
          div.className = "trap-choice-card";
          div.innerHTML = `<div class="card-title"><span>「${escapeHtml(card.name)}」</span><span class="card-type">割り込み</span></div><div class="card-cost">${escapeHtml(card.type)}</div><div class="card-text">${escapeHtml(card.text)}</div>`;
          div.addEventListener("click", () => { cleanup(); resolve(choice.cardId); });
          elements.trapChoiceList.appendChild(div);
        }
        elements.trapSkipBtn.onclick = () => { cleanup(); resolve(null); };
        elements.trapChoice.classList.add("show");
      });
    }

    async function chooseTerminalAppeal(defender, attacker, cardId, card) {
      const choices = terminalAppealChoices(defender);
      if (!choices.length) return null;
      if (defender === "human") return await askHumanTerminalAppeal(defender, card);
      if (state.battleMode === "friend") {
        const response = await requestRemoteFriendDecision("terminalAppeal", { cardId, cardName: card.name });
        return choices.some(choice => choice.cardId === response?.cardId) ? response.cardId : null;
      }
      // CPUは強力な終端を基本的に止める。上告を優先する。
      return choices[0]?.cardId || null;
    }

    async function maybeResolveTerminalAppeal(attacker, rawCardId, cardId, card) {
      if (!card?.terminal || cardId === "appeal" || cardId === "supremeAppeal") return false;
      const defender = otherPlayer(attacker);
      const reactionId = await chooseTerminalAppeal(defender, attacker, cardId, card);
      if (!reactionId) return false;
      const reactionIndex = state.hands[defender].indexOf(reactionId);
      if (reactionIndex < 0) return false;

      // 使用された終端カードは、この時点では攻撃側の捨て札にある。
      const originalIndex = state.discard[attacker].lastIndexOf(rawCardId);
      if (originalIndex < 0) return false;
      state.discard[attacker].splice(originalIndex, 1);
      state.hands[defender].splice(reactionIndex, 1);

      if (!Array.isArray(state.temp[attacker].terminalCardBanIds)) state.temp[attacker].terminalCardBanIds = [];
      if (!state.temp[attacker].terminalCardBanIds.includes(cardId)) state.temp[attacker].terminalCardBanIds.push(cardId);

      if (reactionId === "appeal") {
        // 使用した控訴以外を上告へ変えるため、先に変化させてから使用済み控訴を捨てる。
        transformRemainingAppeals(defender);
        state.discard[defender].push("appeal");
        state.hands[attacker].push(rawCardId);
        addLog(`${handNames[defender]}は「控訴」を発動。「${card.name}」の効果と終端を無効にし、${handNames[attacker]}の手札へ戻した。`);
        await showCardPopup(defender, CARD_LIBRARY.appeal, false, 850);
      } else {
        state.decks[attacker].push(rawCardId);
        shuffle(state.decks[attacker]);
        if (!state.pendingAppealExecution) state.pendingAppealExecution = { human: 0, cpu: 0 };
        state.pendingAppealExecution[attacker] = Number(state.pendingAppealExecution[attacker] || 0) + 1;
        const purged = discardAllRemainingSupremeAppeals(defender);
        state.discard[defender].push("supremeAppeal");
        addLog(`${handNames[defender]}は「上告」を発動。「${card.name}」を${handNames[attacker]}の山札へ戻した。${handNames[attacker]}の次のターン開始時に「執行」が1枚与えられる。残りの上告${purged}枚を捨てた。`);
        await showCardPopup(defender, CARD_LIBRARY.supremeAppeal, false, 900);
      }

      setLastAction(defender, `「${CARD_LIBRARY[reactionId].name}」`, `「${card.name}」を無効化しました。`, "card");
      state.pendingTerminalEnd[attacker] = false;
      render();
      if (state.battleMode === "friend" && !state.friendApplyingRemoteState) {
        state.friendLastPublishedSignature = "";
        await publishFriendStateNow().catch(error => scheduleFriendStatePublish());
      }
      return true;
    }

    async function playCard(player, handIndex, showPopup = true) {
      if(state.startingRouletteActive)return false;
      if(player==="human"&&isFriendInteractionBlocking())return false;
      if (state.gameOver || state.turn !== player) return false;
      if(state.furiosoSkipActive?.[player])return false;
      if(state.quarterRestActive?.[player]){if(player==="human")setMessage("4分休符により、このターンは手札からカードを使用できません。");return false;}
      if ((state.judgmentPrisonTurns?.[player] || 0) > 0) {
        if(player==="human") setMessage("「懲役」により、このターンはカードを使用できません。");
        return false;
      }
      if (state.activeIntemperanceCardLock?.[player]) {
        if (player === "human") {
          const restriction = TURN_RESTRICTIONS[cardUseLockRestrictionType(player)];
          setMessage(getCardUseLockMessage(player));
          await showPopup(player, restriction.title, restriction.text(getPlayerDisplayName(player, { includeYou: state.battleMode === "friend" })), "intemperance-lock", 900, true);
        }
        return false;
      }

      const rawCardId = state.hands[player][handIndex];
      const rawCardInstanceId = handCardInstanceId(player, handIndex);
      const cardId = effectiveCardIdForPlayer(player, rawCardId);
      const card = CARD_LIBRARY[cardId];
      if (!canUseCardUnderRule(player, cardId)) return false;
      if (!canUseCardUnderRule(player, cardId)) return false;

      if (Array.isArray(state.temp[player]?.terminalCardBanIds) && state.temp[player].terminalCardBanIds.includes(cardId)) {
        if (player === "human") setMessage(`「${card?.name || "このカード"}」は控訴・上告により、このターン再使用できません。`);
        return false;
      }

      if (isTutorialBattle() && player === "human" && tutorial.expected !== `card:${cardId}`) {
        setMessage("今は黄色く光っているカードだけを使ってください。");
        return false;
      }
      const forced=state.forcedCard?.[player];
      if(forced?.active&&rawCardInstanceId!==forced.instanceId){if(player==="human")setMessage("「強制」により指定されたカード以外は使用できません。");return false;}
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed(player, cardId);
      const magicalExtraCardPlayable = Number(state.temp[player].cardExtraUses || 0) > 0;
      if (card?.consumesCardAction !== false && state.temp[player].cardActionUsed && !lightSpeedChargePlayable && !magicalExtraCardPlayable) return false;
      if (!card || isAttachmentCard(cardId)) return false;
      if (!card.canPlay(player)) {
        if (player === "human" && cardId === "lightSpeedCircuit") {
          setMessage(
            state.lightSpeedCircuitUsed[player]
              ? "「光速回路」はこの試合ですでに正常発動しています。"
              : "現在は「光速回路」を使用できません。"
          );
        }
        return false;
      }
      if (!canUseChargeCardThisTurn(player, cardId)) {
        if (player === "human") setMessage(`「${card.name}」はこのターンすでに使用しています。`);
        return false;
      }
      if (state.activeCostLimit[player] !== null && card.cost > state.activeCostLimit[player]) {
        if (player === "human") setMessage("倹約令の効果で、コスト2以下のカードしか使えません。");
        return false;
      }
      if (state.berserkerTurns[player] > 0 && !state.temp[player].berserkerJustUsed) {
        if (player === "human") setMessage("バーサーカー中はカードを使えません。");
        return false;
      }

      const cardAllowanceBeforeUse = {
        cardActionUsed: !!state.temp[player].cardActionUsed,
        cardExtraUses: Number(state.temp[player].cardExtraUses || 0)
      };
      if (state.battleMode === "friend") state.friendCardResolving = true;
      state.hands[player].splice(handIndex, 1);
      state.handCardInstances[player].splice(handIndex,1);
      if(!card.vanishOnUse)state.discard[player].push(rawCardId);
      markChargeCardUsedThisTurn(player, cardId);
      if(card.consumesCardAction!==false)consumeCardActionAllowance(player, { lightSpeedChargePlayable });
      if (state.temp[player].directiveActions) state.temp[player].directiveActions.cardUsed = true;
      setLastAction(player, `「${card.name}」`, card.text, "card");

      const visibleText = `${handNames[player]}が「${card.name}」を使用：${card.text}`;
      setMessage(visibleText);
      addLog(`【カード】${visibleText}`);
      render();

      if (state.battleMode === "friend" && player === "human" && cardId !== "finale") {
        emitFriendFx("card", { playerSide: friendSideForLocalPlayer(player), cardId }).catch(error => console.error("PVP card fx failed", error));
      }
      if (showPopup && cardId !== "finale") await showCardPopup(player, card, false, player === "cpu" ? 760 : 520);

      if (card.terminal && await maybeResolveTerminalAppeal(player, rawCardId, cardId, card)) {
        // 控訴・上告で使用そのものが差し戻されたため、消費したカード使用権を使用前の状態へ戻す。
        state.temp[player].cardActionUsed = cardAllowanceBeforeUse.cardActionUsed;
        state.temp[player].cardExtraUses = cardAllowanceBeforeUse.cardExtraUses;
        if (state.battleMode === "friend") {
          state.friendCardResolving = false;
          state.friendLastPublishedSignature = "";
          await publishFriendStateNow().catch(() => scheduleFriendStatePublish());
        }
        if (player === "human") setMessage(`「${card.name}」は無効化されました。カード使用権は返されましたが、このターン同名カードは使用できません。`);
        else setMessage(`CPUの「${card.name}」は無効化され、カード使用権が返されました。`);
        render();
        return true;
      }

      const previousEffectPlayer=state.resolvingEffectPlayer;
      state.resolvingEffectPlayer=player;
      const judgmentVerdictMap = {
        finalJudgmentConfiscation: "没収",
        finalJudgmentDeath: "死刑",
        finalJudgmentPrison: "懲役"
      };
      if (judgmentVerdictMap[cardId]) {
        if (state.battleMode === "friend" && player === "human") {
          await emitFriendFx("judgmentCinematic", {
            playerSide: friendSideForLocalPlayer(player),
            verdict: judgmentVerdictMap[cardId]
          }).catch(error => console.error("PVP judgment cinematic fx failed", error));
        }
        await showJudgmentCinematic(player, judgmentVerdictMap[cardId]);
      }

      recordRondoUse(player, cardId);
      await card.effect(player);
      state.resolvingEffectPlayer=previousEffectPlayer;
      if (card.terminal && !state.pendingTerminalEnd[player] && state.mode === "attack") state.pendingTerminalEnd[player] = true;
      triggerChemicalGeneration(player, cardId);
      checkWin();

      if (isTutorialBattle() && player === "human") {
        tutorialAfterCard(cardId);
      }

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
        } else if (["indiscriminateFire", "shotgun"].includes(cardId) && state.mode === "gunAmmoDiscard") {
          setMessage(`「${card.name}」：弾薬として捨てる手札を1枚選んでください。`);
        } else if (cardId === "modulation" && state.mode === "modulationSource") {
          setMessage("「変調」：変化させる手札の銃カードを選んでください。");
        } else if (cardId === "fanning" && state.mode === "fanningTarget") {
          setMessage(`「ファニング」：${state.pendingFanning?.shots || 0}回射撃する相手の0ではない手を選んでください。`);
        } else if (cardId === "calmDown" && state.mode === "calmDownDiscard") {
          setMessage("「落ち着ける」：捨てる手札を1枚選んでください。");
        } else if (cardId === "andante" && state.mode === "andante") {
          setMessage("「アンダンテ」：微調整する自分の0でない手を選んでください。");
        } else if (cardId === "arcanaSlave" && state.mode === "arcanaSlaveTarget") {
          setMessage("「アルカナ・スレイブ！！」：0にする相手の手を選んでください。");
        } else if (cardId === "withLove" && state.mode === "magicalWithLove") {
          setMessage("「愛で！」：2にする自分の手を選んでください。0の手も選べます。");
        } else if (cardId === "betrayedHeart" && state.mode === "magicalBetrayedHeart") {
          setMessage("「裏切られた心」：1本増やす自分の0でない手を選んでください。");
        } else if (cardId === "dimensionalSlash" && state.mode === "dimensionalSlashSacrifice") {
          setMessage("「空間切断」：代償として0にする自分の手を選んでください。");
        } else if (cardId === "setupTrap" && state.temp.human.setupMode) {
          setMessage("「仕込み」：罠を好きなだけ伏せられます。終わったら「仕込み終了」を押してください。");
        } else {
          setMessage(`「${card.name}」を使いました。まだ攻撃か分けるができます。`);
        }
      } else {
        setMessage(`CPUが「${card.name}」を使いました。`);
      }

      render();
      if (state.battleMode === "friend") {
        state.friendCardResolving = false;
        scheduleFriendStatePublish();
      }

      if (state.pendingTerminalEnd[player] && player === "human" && state.turn === "human") {
        state.pendingTerminalEnd[player] = false;
        await endTurn();
        return true;
      }

      // Promise型の選択効果はcard.effect()が完全解決するまでここへ戻らない。
      // 旧式の選択modeはhelper側のmodeガードにより、選択完了前には終了しない。
      if (await maybeAutoEndTurnForNoActions(player)) return true;

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
      } else if (state.battleMode === "friend") {
        const response = await requestRemoteFriendDecision("nekodamashi", {
          targetHand: context.targetHand,
          attackHand: context.attackHand,
          isRapidFire: !!context.isRapidFire
        });
        use = !!response?.use;
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
      if (state.battleMode === "friend") {
        try {
          const response = await requestRemoteFriendDecision("manualTrap", {
            candidates: candidates.map(info => ({ placedHand: info.placedHand, index: info.index, cardId: info.cardId })),
            attackHand: context.attackHand,
            targetHand: context.targetHand,
            isRapidFire: !!context.isRapidFire,
            timing: context.resolvedFinal !== undefined ? "after" : "before"
          });
          if (response?.skipped || !response?.chosen) {
            addLog(`${handNames[defender]}は手動罠を発動しなかった。`);
            return null;
          }
          const chosen = response.chosen;
          return candidates.find(info => info.placedHand === chosen.placedHand && info.index === Number(chosen.index) && info.cardId === chosen.cardId) || null;
        } catch (error) {
          console.error("PVP manual trap decision failed", error);
          state.friendInterruptWaiting = null;
          addLog(`手動罠のオンライン確認に失敗したため、発動しないものとして処理を続行した。`);
          return null;
        } finally {
          render();
        }
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
      if (state.battleMode === "friend" && defender === "cpu") {
        // 守備側の実端末が既に自分の画面で表示するため、攻撃側へ公開演出を送る。
        emitFriendFx("trapReveal", { playerSide: friendSideForLocalPlayer(defender), cardId }).catch(error => console.error("PVP trap fx failed", error));
      } else if (state.battleMode === "friend" && defender === "human") {
        emitFriendFx("trapReveal", { playerSide: friendSideForLocalPlayer(defender), cardId }).catch(error => console.error("PVP trap fx failed", error));
      }
      await showCardPopup(defender, card, true, 760);
      const result = await card.trigger({ ...context, defender, placedHand }) || {};
      render();

      // 第4章の空振りは、選択画面で選んだ時ではなく
      // 実際の罠効果が完了した後に次の課題へ進める。
      if (
        isTutorialBattle() &&
        tutorial.chapter === 4 &&
        tutorial.step === 2 &&
        defender === "human" &&
        cardId === "dodgeTrap"
      ) {
        setTimeout(() => {
          if (!isTutorialBattle() || tutorial.chapter !== 4 || tutorial.step !== 2) return;
          tutorial.step = 3;
          freezeTutorialBattleToHumanTurn();
          renderRealTutorialStep();
        }, 500);
      }

      return result;
    }

        async function addFingersWithCalculation(player, hand, amount, sourceLabel, ignoreGuard = false, options = {}) {
      const effectActor=options.sourcePlayer||state.resolvingEffectPlayer;
      if(isRomanOpponentTarget(effectActor,player)){addLog(`${sourceLabel}の相手側効果は準備時間中のため無効。`);return false;}
      if (amount <= 0 || (!options.allowZeroTarget && state[player][hand] <= 0)) return false;
      const actual = ignoreGuard ? Math.max(1, amount) : applyGuardBlessingReduction(player, hand, amount, sourceLabel);
      const before = state[player][hand];
      const total = before + actual;
      const directiveActor=options.sourcePlayer || state.turn;
      const annihilationActive=!!state.activeDirectiveAnnihilation?.[directiveActor]&&player===otherPlayer(directiveActor);
      const finalValue=(options.zeroAtSeven&&total>=7)||annihilationActive&&total>=7?0:normalize(total,player,hand);
      await animateCalculation(player, hand, total, finalValue);
      state[player][hand] = finalValue;
      if(player===otherPlayer(directiveActor)&&before>0&&finalValue===0&&state.temp?.[directiveActor])state.temp[directiveActor].opponentZeroedThisTurn=true;
      addLog(`${sourceLabel}により、${handNames[player]}の${handNames[hand]}：${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      clearBrokenTraps(player);
      return true;
    }

    function resonanceThreshold(attacker, attackHand) {
      return hasAttachment(attacker, attackHand, "resonanceTuning") ? 1 : 0;
    }

    function isResonanceAttack(attacker, attackHand, defender, targetHand) {
      if (!isAlive(attacker, attackHand) || !isAlive(defender, targetHand)) return false;
      return isResonanceAttackAtStart(attacker, attackHand, state[attacker][attackHand], state[defender][targetHand]);
    }

    function isResonanceAttackAtStart(attacker, attackHand, attackStartPower, targetStartPower) {
      if (attackStartPower <= 0 || targetStartPower < 0) return false;
      return Math.abs(attackStartPower - targetStartPower) <= resonanceThreshold(attacker, attackHand);
    }

    function resonanceAttackBonus(attacker, attackHand, resonance, immutable = false) {
      if (!resonance || immutable) return 0;
      let bonus = 0;
      if (state.temp[attacker]?.crescendo) bonus += 2;
      if (hasAttachment(attacker, attackHand, "largo")) bonus += 1;
      return bonus;
    }

    async function resolveResonanceRewards(attacker, attackHand, resonance) {
      if (!resonance) return;
      addLog(`${handNames[attacker]}の${handNames[attackHand]}が共鳴した。`);
      state.resonanceTriggeredThisTurn[attacker] = true;
      if (state.selectedTheme?.[attacker] === "serenade") {
        if (getPerformanceLevel(attacker) === 0) setPerformanceLevel(attacker, 2, "セレナーデ初回共鳴");
        else changePerformanceLevel(attacker, 2, "セレナーデ共鳴");
      }

      if (state.temp[attacker]?.allegro && !state.temp[attacker].allegroTriggered) {
        state.temp[attacker].allegroTriggered = true;
        drawCard(attacker);
        drawCard(attacker);
        addLog(`${handNames[attacker]}の「アレグロ」により、カードを2枚引いた。`);
      }

      if (hasAttachment(attacker, attackHand, "largo")) {
        drawCard(attacker);
        addLog(`${handNames[attacker]}の「ラルゴ」により、カードを1枚引いた。`);
      }

      if (state.temp[attacker]?.lastMelody) {
        state.temp[attacker].lastMelody = false;
        const before = state[attacker][attackHand];
        if (before > 0) {
          state[attacker][attackHand] = 0;
          clearBrokenTraps(attacker);
          if (state[attacker][attackHand] === 0) {
            state.hands[attacker].push("finale");
            addLog(`${handNames[attacker]}の「最後の旋律」により、共鳴した${handNames[attackHand]}が${before}→0。「フィナーレ」を手札に加えた。`);
            setLastAction(attacker, "最後の旋律", `${handNames[attackHand]}を0にし、「フィナーレ」を手札に加えた。`, "card");
          }
        }
      }
    }

    async function resolveAfterAttackBlessings(attacker, attackHand, defender, targetHand, attackTotal, canceled = false) {
      if (canceled) {
        if (hasAttachment(attacker, attackHand, "recklessBlessing") && state[attacker][attackHand] > 0) {
          await addFingersWithCalculation(attacker, attackHand, 1, "捨て身の反動");
        }
        return;
      }

      if (defender === otherPlayer(attacker) && hasAttachment(attacker, attackHand, "ricochetBlessing")) {
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

    function resolveGrowthBeforeFiveToZero(attacker, attackHand, result) {
      if (result !== 5 || !hasAttachment(attacker, attackHand, "growthBlessing")) return false;
      drawCard(attacker);
      addLog(`${handNames[attacker]}は「成長」によりカードを1枚引いた。`);
      return true;
    }

    async function resolveAfterAttackTraps({attacker,attackHand,defender,targetHand,incomingPower,attackTotal,resolvedFinal,trapUsed,ignoresDefenderBoard}) {
      if (trapUsed || ignoresDefenderBoard || (defender === otherPlayer(attacker) && state.temp[attacker].electromagneticAttack)) {
        return {trapUsed,resolvedFinal};
      }
      const afterContext = {defender,targetHand,attacker,attackHand,incomingPower,attackTotal,resolvedFinal};
      const afterManual = getTriggerTraps(defender,targetHand,attacker,attackHand,incomingPower,"after",true,afterContext);
      const chosenAfterManual = await maybeChooseManualTrap(defender,afterManual,afterContext);
      if (chosenAfterManual) {
        const afterResult = await triggerTrap(defender,chosenAfterManual,afterContext);
        trapUsed = true;
        if (afterResult.stopAtFour) {
          resolvedFinal = 4;
          state[defender][targetHand] = 4;
        }
      } else {
        const afterAuto = getTriggerTraps(defender,targetHand,attacker,attackHand,incomingPower,"after",false,afterContext);
        if (afterAuto.length > 0) {
          await triggerTrap(defender,afterAuto[0],afterContext);
          trapUsed = true;
        }
      }
      return {trapUsed,resolvedFinal};
    }

    async function completeNormalAttackAttempt(attacker) {
      const attackerTemp = state.temp[attacker];
      const usedExtraAction = !!state.activeExtraAction?.[attacker];
      if (usedExtraAction) {
        state.activeExtraAction[attacker] = false;
        state.extraActions[attacker] = Math.max(0, Number(state.extraActions[attacker] || 0) - 1);
        attackerTemp.extraActionJustConsumed = true;
      }
      attackerTemp.attacksUsed = Number(attackerTemp.attacksUsed || 0) + 1;

      const completedAttacks = attackerTemp.attacksUsed;
      const attackLimit = Math.max(0, Number(attackerTemp.attackLimit ?? 1));
      const hasRemainingAttack = completedAttacks < attackLimit;

      if (!hasRemainingAttack || usedExtraAction) {
        state.pendingTerminalEnd[attacker] = true;
      }

      if (
        state.battleMode === "friend" &&
        attacker === "human" &&
        attackLimit > 1 &&
        hasRemainingAttack &&
        !state.gameOver
      ) {
        try {
          // 直前の予約同期と署名が競合しても、途中結果を必ず新しいrevisionで送る。
          state.friendLastPublishedSignature = "";
          await publishFriendStateNow();
          const source = attackerTemp.multiAttackSource || "追加攻撃";
          addLog(`「${source}」：${completedAttacks}回目の攻撃結果をオンライン対戦相手へ同期した。`);
        } catch (error) {
          console.error("PVP multi-attack intermediate sync failed", error);
          setMessage(`複数回攻撃の途中同期エラー：${error.message || error}`);
        }
      }

      return { completedAttacks, attackLimit, hasRemainingAttack };
    }

    async function resolveInternalNormalAttack({attackerPlayer,attackerHand,targetPlayer,targetHand,allowZeroTarget=false,sourceCardId=null,afterResolved=null}) {
      return await attack(attackerPlayer,attackerHand,targetPlayer,targetHand,{
        countAttackAttempt:false,
        cardInternalAttack:true,
        allowZeroTarget,
        sourceCardId,
        sourceLabel:CARD_LIBRARY[sourceCardId]?.name||"内部通常攻撃",
        preventTargetChange:true,
        afterResolved
      });
    }

async function attack(attacker, attackHand, defender, targetHand, options = {}) {
      if(state.startingRouletteActive)return false;
      if(attacker==="human"&&!options.cardInternalAttack&&isFriendInteractionBlocking())return false;
      if(!options.cardInternalAttack&&!canUseNormalAttackAction(attacker)){if(attacker==="human")setMessage("このターンは通常攻撃できません。");return false;}
      if(state.furiosoSkipActive?.[attacker]&&!options.cardInternalAttack)return false;
      if(state.temp[attacker]?.multiAttackSource==="Furioso"&&Number(state.temp[attacker]?.attackLimit)===0&&!options.cardInternalAttack)return false;
      if(state.wholeRestActive?.[attacker]&&!options.cardInternalAttack){if(attacker==="human")setMessage("全休符により通常攻撃行動はできません。");return false;}
      if(hasAttachment(attacker,attackHand,"sniperBlessing")){if(attacker==="human")setMessage("「狙撃の加護」が付いた手では攻撃できません。");return false;}
      const completeAttackAttempt = async () => {
        if (options.countAttackAttempt === false) return null;
        return await completeNormalAttackAttempt(attacker);
      };
      if (isTutorialBattle() && attacker === "cpu" && !state.tutorialScriptedCpuAction) {
        console.warn("Blocked unscripted CPU action during tutorial.");
        freezeTutorialBattleToHumanTurn();
        return false;
      }
      if (!isAlive(attacker, attackHand) || (!options.allowZeroTarget && !isAlive(defender, targetHand))) return false;

      if (!options.preventTargetChange && hasAttachment(attacker, attackHand, "magicalWrath")) {
        const candidates = [
          {owner:attacker, hand:otherHand(attackHand)},
          {owner:defender, hand:"L"},
          {owner:defender, hand:"R"}
        ].filter(x => isAlive(x.owner,x.hand));
        if (candidates.length) {
          const chosen=candidates[Math.floor(Math.random()*candidates.length)];
          defender=chosen.owner;
          targetHand=chosen.hand;
          addLog(`「憤怒」により攻撃対象がランダムに${handNames[defender]}の${handNames[targetHand]}へ変更された。`);
        }
      }

      const danceActive = !!state.temp[attacker]?.dance;
      // 乱舞は攻撃行動枠を使う「置換攻撃」であり、通常攻撃の履歴・予約を消費しない。
      if (danceActive) state.temp[attacker].dance = false;
      if (!danceActive) {
        state.temp[attacker].attacksOccurredThisTurn=Number(state.temp[attacker].attacksOccurredThisTurn||0)+1;
      }

      const frenzyActive = !danceActive && !!state.temp[attacker]?.frenzyAttack;
      const rationalPowerActive = !danceActive && !!state.temp[attacker]?.rationalPowerAttack;
      const selfRighteousActive = !danceActive && !!state.temp[attacker]?.selfRighteousAttack;
      const justiceForEveryoneActive = !danceActive && !!state.temp[attacker]?.justiceForEveryoneAttack;
      const tearSharpenedSwordActive = !danceActive && !!state.temp[attacker]?.tearSharpenedSwordAttack;
      const goldRushActive = !danceActive && !!state.temp[attacker]?.goldRushAttack;
      const balanceBladeActive = !danceActive && !!state.temp[attacker]?.balanceBladeAttack;
      const canonActive = !danceActive && !!state.temp[attacker]?.canon;
      if (!danceActive) {
        state.temp[attacker].canon = false;
        state.temp[attacker].frenzyAttack = false;
        state.temp[attacker].rationalPowerAttack = false;
        state.temp[attacker].selfRighteousAttack = false;
        state.temp[attacker].justiceForEveryoneAttack = false;
        state.temp[attacker].tearSharpenedSwordAttack = false;
        state.temp[attacker].goldRushAttack = false;
        state.temp[attacker].balanceBladeAttack = false;
      }

      if (frenzyActive && !options.preventTargetChange) {
        const originalOpponent = otherPlayer(attacker);
        const candidates = [
          { owner: originalOpponent, hand: "L" },
          { owner: originalOpponent, hand: "R" },
          { owner: attacker, hand: otherHand(attackHand) }
        ].filter(x => isAlive(x.owner, x.hand));
        if (candidates.length > 0) {
          const chosen = candidates[Math.floor(Math.random() * candidates.length)];
          defender = chosen.owner;
          targetHand = chosen.hand;
          addLog(`「狂乱」により攻撃対象が${handNames[defender]}の${handNames[targetHand]}へ変更された。`);
        }
      }

      if (options.sourceCardId && CARD_LIBRARY[options.sourceCardId]?.gun
          && await blockWithBulletproofVest(defender, targetHand, options.sourceCardId, CARD_LIBRARY[options.sourceCardId].name)) {
        state.animating = false;
        clearHighlights();
        render();
        return true;
      }

      const attackStartPower = state[attacker][attackHand];
      let targetStartPower = state[defender][targetHand];
      const prestoModifier = !danceActive && state.pendingPrestoAttack?.[attacker]
        ? [1, 0, -1, -2][randomIndex(4)]
        : null;
      if (prestoModifier !== null) {
        state.pendingPrestoAttack[attacker] = false;
        addLog(`プレスト：攻撃補正 ${prestoModifier > 0 ? "+" : ""}${prestoModifier}`);
      }

      state.animating = true;
      render();

      /*
       * ATTACK CORE RULE:
       * 通常攻撃力 = basePower + attackModifier。
       * 不変の呪縛は、攻撃する手に付いている場合、その通常攻撃のattackModifierを正負とも0にする。
       * ゴールドラッシュは通常攻撃の加算量置換。乱舞は通常攻撃ではない置換攻撃。
       * どちらもattackModifierを使用せず、乱舞はreceivedAmountも使用しない。
       * 防御側の軽減・増加は、その後のreceivedAmountとして別に処理する。
       */
      const normalBasePower = state[attacker][attackHand];
      let immutable = hasImmutableCurse(attacker, attackHand);
      const goldRushBase = countHandCards(attacker);
      const basePower = goldRushActive ? goldRushBase : normalBasePower;
      const attackReplacementKind = danceActive ? "result" : goldRushActive ? "amount" : null;
      const isAttackReplacement = attackReplacementKind !== null;
      const rawBonus = state.temp[attacker].attackBonus || 0;
      const pendingDirectiveHandBonus=Number(state.pendingDirectiveHandAttackModifier?.[attacker]?.[attackHand]||0);
      const pendingDirectiveNextBonus=Number(state.pendingDirectiveNextAttackModifier?.[attacker]||0);
      const directiveHandBonus=pendingDirectiveHandBonus;
      const directiveNextBonus=pendingDirectiveNextBonus;
      if (!danceActive) {
        state.pendingDirectiveHandAttackModifier[attacker][attackHand]=0;
        state.pendingDirectiveNextAttackModifier[attacker]=0;
      }
      const bonus = rawBonus;
      const berserkerBonus = state.berserkerTurns[attacker] > 0 ? 2 : 0;
      const magicalAttackBonus = (
        hasAttachment(attacker, attackHand, "magicalHatred") ||
        hasAttachment(attacker, attackHand, "magicalLove") ||
        hasAttachment(attacker, attackHand, "magicalCourage") ? 1 : 0
      );
      const blessingBonus = hasAttachment(attacker, attackHand, "powerBlessing") ? 1 : 0;
      const willBladeBonus = hasAttachment(attacker, attackHand, "willBlade") ? (state.lastDirectiveClearCount?.[attacker] || 0) : 0;
      const recklessBonus = hasAttachment(attacker, attackHand, "recklessBlessing") ? 2 : 0;
      const cursePenalty = hasAttachment(attacker, attackHand, "slowCurse") ? -1 : 0;
      let duelSurgeBonus = 0;
      const lightningBonus=state.temp[attacker].lightningBonus||0;
      const synapseBonus=state.temp[attacker].synapseBonus||0;
      const dimensionalSlashBonus=state.temp[attacker].dimensionalSlashBonus||0;
      const frenzyBonus = frenzyActive ? 2 : 0;
      const rationalPowerBonus = rationalPowerActive ? 1 : 0;
      const selfRighteousBonus = selfRighteousActive ? 2 : 0;
      const justiceForEveryoneBonus = justiceForEveryoneActive ? 1 : 0;
      const dischargeBonus=hasAttachment(attacker,attackHand,"dischargeBlessing")&&getChargeLevel(attacker)>=10?1:0;
      const balanceBladeBonus = balanceBladeActive && isBalanced(attacker) ? 2 : 0;
      // 攻撃結果置換でも共鳴した事実は成立し得る。加算ボーナスだけを置換結果へ反映しない。
      let resonance = !danceActive && isResonanceAttackAtStart(attacker, attackHand, attackStartPower, targetStartPower);
      let resonanceBonus = resonanceAttackBonus(attacker, attackHand, resonance, false);
      const sforzandoBonus = Number(state.sforzandoTurnBonus?.[attacker] || 0);
      const betrayedHeartPenalty = state.temp[attacker]?.betrayedHeartPenalty ? -1 : 0;
      const prestoAttackModifier = prestoModifier ?? 0;
      let trapPowerDelta = 0;
      const calculateAttackModifier = () => bonus + directiveHandBonus + directiveNextBonus + berserkerBonus + blessingBonus + magicalAttackBonus + recklessBonus + willBladeBonus + duelSurgeBonus + lightningBonus + synapseBonus + dimensionalSlashBonus + frenzyBonus + rationalPowerBonus + selfRighteousBonus + justiceForEveryoneBonus + dischargeBonus + balanceBladeBonus + cursePenalty + resonanceBonus + sforzandoBonus + betrayedHeartPenalty + prestoAttackModifier + trapPowerDelta;
      const calculateFinalAttackPower = () => {
        const modifier = calculateAttackModifier();
        const modifiersBlocked = immutable || isAttackReplacement;
        const appliedPresto = modifiersBlocked ? 0 : prestoAttackModifier;
        const modifierBeforePresto = modifiersBlocked ? 0 : modifier - prestoAttackModifier;
        return {
          attackModifier: modifiersBlocked ? 0 : modifier,
          // 既存プレストは最低1処理後に加算され、負の攻撃量にもなり得る。
          finalAttackPower: Math.max(goldRushActive ? 0 : 1, basePower + modifierBeforePresto) + appliedPresto
        };
      };
      let attackPowerResult = calculateFinalAttackPower();
      let power = attackPowerResult.finalAttackPower;
      if (!danceActive) state.temp[attacker].attackBonus = 0;
      if (isAttackReplacement && calculateAttackModifier() !== 0) {
        addLog(`攻撃置換中のため、通常攻撃で加える本数への増減${calculateAttackModifier() >= 0 ? "+" : ""}${calculateAttackModifier()}は適用されない。`);
      } else if (immutable && calculateAttackModifier() !== 0) {
        addLog(`${handNames[attacker]}の${handNames[attackHand]}の「不変の呪縛」により、通常攻撃で加える本数への増減${calculateAttackModifier() >= 0 ? "+" : ""}${calculateAttackModifier()}を無効化した。`);
      }
      const attackModifierLogsApply = !immutable && !isAttackReplacement;
      if (attackModifierLogsApply && blessingBonus) addLog(`${handNames[attacker]}の「力の加護」により、通常攻撃で加える本数+1。`);
      if (attackModifierLogsApply && magicalAttackBonus) addLog(`${handNames[attacker]}の魔法少女加護により、通常攻撃で加える本数+1。`);
      if (attackModifierLogsApply && recklessBonus) addLog(`${handNames[attacker]}の「捨て身」により、通常攻撃で加える本数+2。`);
      if (attackModifierLogsApply && willBladeBonus) addLog(`${handNames[attacker]}の「意志の剣」により、通常攻撃で加える本数+${willBladeBonus}。`);
      if (attackModifierLogsApply && dimensionalSlashBonus) addLog(`${handNames[attacker]}の「空間切断」により、通常攻撃で加える本数+${dimensionalSlashBonus}。`);
      if (goldRushActive) addLog(`${handNames[attacker]}の「ゴールドラッシュ」により、攻撃の基本本数が手札枚数の${basePower}になった。`);
      if (attackModifierLogsApply && frenzyBonus) addLog(`${handNames[attacker]}の「狂乱」により、通常攻撃で加える本数+2。`);
      if (attackModifierLogsApply && rationalPowerBonus) addLog(`${handNames[attacker]}の「理性ある力」により、通常攻撃で加える本数+1。`);
      if (attackModifierLogsApply && selfRighteousBonus) addLog(`${handNames[attacker]}の「独善」により、通常攻撃で加える本数+2。`);
      if (attackModifierLogsApply && balanceBladeBonus) addLog(`${handNames[attacker]}の「均衡の刃」により、通常攻撃で加える本数+2。`);
      if (attackModifierLogsApply && justiceForEveryoneBonus) addLog(`${handNames[attacker]}の「みんなのための正義」により、通常攻撃で加える本数+1。`);
      if (attackModifierLogsApply && sforzandoBonus) addLog(`${handNames[attacker]}の「スフォルツァント」により、通常攻撃で加える本数+${sforzandoBonus}。`);
      if(attackModifierLogsApply&&(directiveHandBonus||directiveNextBonus))addLog(`${handNames[attacker]}の指令効果により、通常攻撃で加える本数${directiveHandBonus+directiveNextBonus>=0?"+":""}${directiveHandBonus+directiveNextBonus}。`);
      if (attackModifierLogsApply && resonance && state.temp[attacker]?.crescendo) addLog(`${handNames[attacker]}の「クレッシェンド」により、共鳴した通常攻撃で加える本数+2。`);
      if (attackModifierLogsApply && resonance && hasAttachment(attacker, attackHand, "largo")) addLog(`${handNames[attacker]}の「ラルゴ」により、共鳴した通常攻撃で加える本数+1。`);
      if (attackModifierLogsApply && cursePenalty) addLog(`${handNames[attacker]}の「鈍重の呪縛」により、通常攻撃で加える本数-1。`);
      const ignoresDefenderBoard = defender === otherPlayer(attacker) && ignoresOpponentBoardEffects(attacker);
      if (ignoresDefenderBoard) {
        addLog(`${handNames[attacker]}の「強行突破」により、相手側の加護・呪縛効果を無視する。`);
      }

      let context = { defender, targetHand, attacker, attackHand, incomingPower: power };
      let trapUsed = false;
      let trapResult = {};

      if (await maybeUseNekodamashi(defender, context)) {
        addLog(`${handNames[attacker]}の攻撃は「ねこだまし」で無効になった。`);
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      if (state.battleMode === "friend" && attacker === "human") {
        emitFriendFx("attack", {
          attackerSide: friendSideForLocalPlayer(attacker),
          attackHand,
          defenderSide: friendSideForLocalPlayer(defender),
          targetHand
        }).catch(error => console.error("PVP attack fx failed", error));
      }
      await animateAttackIntent(attacker, attackHand, defender, targetHand);

      // 攻撃判定前：対象変更・無効化など。強行突破中はここを封じる。
      if (ignoresDefenderBoard || (defender === otherPlayer(attacker) && state.temp[attacker].electromagneticAttack)) {
        addLog(state.temp[attacker].electromagneticAttack
          ? `${handNames[attacker]}の「電磁攻撃」により、相手の罠は発動しない。`
          : `${handNames[attacker]}の「強行突破」により、攻撃中の相手側の罠は発動できない。`);
      } else {
        const beforeManual = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "before", true)
          .filter(info => (!options.preventTargetChange || !["deflect", "attention"].includes(info.cardId)) && !(danceActive && info.cardId === "puddleTrap"));
        const chosenBeforeManual = await maybeChooseManualTrap(defender, beforeManual, context);
        if (chosenBeforeManual) {
          trapResult = await triggerTrap(defender, chosenBeforeManual, context);
          trapUsed = true;
        } else {
          const beforeAuto = getTriggerTraps(defender, targetHand, attacker, attackHand, power, "before", false)
            .filter(info => (!options.preventTargetChange || !["deflect", "attention"].includes(info.cardId)) && !(danceActive && info.cardId === "puddleTrap"));
          if (beforeAuto.length > 0) {
            trapResult = await triggerTrap(defender, beforeAuto[0], context);
            trapUsed = true;
          }
        }
      }

      if (typeof trapResult.powerDelta === "number") {
        const oldPower = power;
        trapPowerDelta += trapResult.powerDelta;
        attackPowerResult = calculateFinalAttackPower();
        power = Math.max(trapResult.allowZeroPower ? 0 : 1, attackPowerResult.finalAttackPower);
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        if (immutable || isAttackReplacement) {
          addLog(`${isAttackReplacement ? "攻撃置換" : "「不変の呪縛」"}により、罠による加える本数への増減${trapResult.powerDelta >= 0 ? "+" : ""}${trapResult.powerDelta}を無効化した。`);
        } else if (oldPower !== power) addLog(`この攻撃で加える本数が${oldPower}→${power}になった。`);
      }

      if (trapResult.targetHand) {
        targetHand = trapResult.targetHand;
        targetStartPower = state[defender][targetHand];
        const redirectedResonance = !danceActive && isResonanceAttackAtStart(attacker, attackHand, attackStartPower, targetStartPower);
        const redirectedBonus = resonanceAttackBonus(attacker, attackHand, redirectedResonance, false);
        resonanceBonus = redirectedBonus;
        resonance = redirectedResonance;
        immutable = hasImmutableCurse(attacker, attackHand);
        attackPowerResult = calculateFinalAttackPower();
        power = attackPowerResult.finalAttackPower;
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        if (state.battleMode === "friend" && attacker === "human") {
          emitFriendFx("attack", {
            attackerSide: friendSideForLocalPlayer(attacker),
            attackHand,
            defenderSide: friendSideForLocalPlayer(defender),
            targetHand
          }).catch(error => console.error("PVP redirected attack fx failed", error));
        }
        await animateAttackIntent(attacker, attackHand, defender, targetHand);
      }

      // 「銛を埋める」は対象変更後・攻撃結果確定前に最終対象へ付与する。
      // この後に空振り等で無効化されても、付与済みの銛は残る。
      if (!danceActive && !isRomanOpponentTarget(attacker,defender)) resolveHarpoonBeforeAttack(attacker,defender,targetHand,{isInternal:!!options.cardInternalAttack});

      if (tearSharpenedSwordActive && !isRomanOpponentTarget(attacker,defender)) {
        discardAllBlessingsFromHand(defender, targetHand, "「涙で研ぎ澄まされた剣」");
        render();
      }

      if (!danceActive && hasAttachment(defender, targetHand, "villainMark")) {
        trapPowerDelta += 1;
        attackPowerResult = calculateFinalAttackPower();
        power = attackPowerResult.finalAttackPower;
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        drawCard(attacker);
        const villainMarkReason = isAttackReplacement
          ? "攻撃置換のため適用されない"
          : immutable ? "「不変の呪縛」により無効" : "適用";
        addLog(villainMarkReason === "適用"
          ? `${handNames[defender]}の${handNames[targetHand]}の「悪党の印」により、通常攻撃で加える本数+1。${handNames[attacker]}はカードを1枚引いた。`
          : `${handNames[defender]}の${handNames[targetHand]}の「悪党の印」による加える本数+1は${villainMarkReason}。${handNames[attacker]}はカードを1枚引いた。`);
      }

      if (!danceActive) recordDirectiveAttack(attacker, attackHand, defender, targetHand);
      if (!danceActive) {
        state.temp[attacker].lightningBonus=0;
        state.temp[attacker].synapseBonus=0;
      }
      const duelUpdate = !danceActive ? updateDuelSurge(attacker, attackHand, defender, targetHand) : { bonus: 0, level: 0 };
      if (duelUpdate.bonus > 0) {
        duelSurgeBonus = duelUpdate.bonus;
        attackPowerResult = calculateFinalAttackPower();
        power = attackPowerResult.finalAttackPower;
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        addLog((immutable || isAttackReplacement)
          ? `${handNames[attacker]}の「決闘高潮」Lv.${duelUpdate.level}による加える本数+${duelSurgeBonus}は${isAttackReplacement ? "攻撃置換のため適用されない" : "「不変の呪縛」により無効"}。`
          : `${handNames[attacker]}の「決闘高潮」Lv.${duelUpdate.level}により、通常攻撃で加える本数+${duelSurgeBonus}。`);
      }

      if (trapResult.cancelAttack) {
        if (!danceActive && state.temp[attacker].lightningZeroAtFive) {
          state.temp[attacker].lightningZeroAtFive = false;
          state.temp[attacker].lightningNoChargeGain = false;
          addLog(`「雷撃」の充電Lv.10効果は、攻撃が無効になったため消費された。`);
        }
        addLog(`${handNames[attacker]}の攻撃は無効になった。`);
        setLastAction(attacker, "攻撃", "攻撃は無効になりました。", "action");

        if (!danceActive) state.temp[attacker].lightningNoChargeGain = false;
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      if (!options.allowZeroTarget && !isAlive(defender, targetHand)) {
        addLog(`攻撃対象が0になっていたため、攻撃は失敗した。`);
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      if (danceActive) {
        const before = state[defender][targetHand];
        const matched = state[attacker][attackHand];
        let resolvedFinal = wrapFinger(matched);
        state[defender][targetHand] = resolvedFinal;
        state.lastAttackContext = {attackKind:"replacement",attacker,sourceHand:attackHand,defender,targetHand,basePower:null,attackModifier:null,finalAttackPower:null,receivedAmount:null,isAttackReplacement:true,attackReplacementKind:"result",isNormalAttack:false,isCardAttack:false};
        addLog(`${handNames[attacker]}の「乱舞」により、ダメージは発生せず、${handNames[defender]}の${handNames[targetHand]}を${before}→${matched}${matched!==resolvedFinal?`→${resolvedFinal}`:""}に変更した。`);
        const afterTrapResult = await resolveAfterAttackTraps({attacker,attackHand,defender,targetHand,incomingPower:0,attackTotal:matched,resolvedFinal,trapUsed,ignoresDefenderBoard});
        trapUsed = afterTrapResult.trapUsed;
        resolvedFinal = afterTrapResult.resolvedFinal;
        setLastAction(attacker, "乱舞", `${handNames[attackHand]}と${handNames[defender]}の${handNames[targetHand]}の本数を揃えた。`, "card");
        clearBrokenTraps(defender);
        clearBrokenTraps(attacker);
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      // finalAttackPower確定後、防御側の「受ける本数」補正を適用する。
      // 不変の呪縛はこのreceivedAmountレイヤーには干渉しない。
      attackPowerResult = calculateFinalAttackPower();
      power = attackPowerResult.finalAttackPower;
      const finalAttackPower = power;
      if (!ignoresDefenderBoard && power > 0) {
        if (state.temp[defender]?.knightCreed) {
          power = 0;
        } else {
          if (state.temp[defender]?.fadedCreedGuard) {
            power = Math.max(1, power - 1);
            addLog(`${handNames[defender]}の「色褪せた信条」により、受ける本数-1。`);
          }
          power = applyGuardBlessingReduction(defender, targetHand, power, "攻撃");
        }
        if (hasAttachment(defender,targetHand,"scalesBlessing")) {
          const beforeScale=power;
          power = isBalanced(defender) ? Math.max(0,power-2) : power+1;
          addLog(`${handNames[defender]}の「天秤の加護」により、受ける本数が${beforeScale}→${power}。`);
        }
        if (hasAttachment(defender,targetHand,"magicalDespair")) {
          const beforeDespair = power;
          power=Math.max(0,power-1);
          addLog(`${handNames[defender]}の「絶望」により、受ける本数が${beforeDespair}→${power}になった。`);
        }
        if (hasMagicalJustice(defender)) {
          power=Math.max(1,power-2);
          addLog(`${handNames[defender]}の「正義」により、受ける本数-2。`);
        }
      }
      const receivedAmount = power;
      state.lastAttackContext = {attackKind:"normal",attacker,sourceHand:attackHand,defender,targetHand,basePower,attackModifier:attackPowerResult.attackModifier,finalAttackPower,receivedAmount,appliedAmount:canonActive?0:receivedAmount,canonActive,isAttackReplacement,attackReplacementKind,isNormalAttack:true,isCardAttack:false};

      if (power <= 0 && prestoModifier === null && state.temp[defender]?.knightCreed) {
        addLog(`${handNames[defender]}の「騎士の信条」により通常攻撃は無効になった。`);
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      // カノンは通常攻撃を最後まで成立させる。罠・補正後の「本来加える本数」と
      // 最終対象を保存し、この攻撃で盤面へ実際に加える本数だけを0にする。
      if(canonActive){
        if(power!==0){
          state.pendingCanonHits.push({sourcePlayer:attacker,waitForPlayer:otherPlayer(attacker),defender,targetHand,amount:power});
          addLog(`${handNames[attacker]}の「カノン」は${handNames[defender]}の${handNames[targetHand]}へ本来加える${power}本を記録した。この攻撃で実際に加える本数は0。`);
        }else{
          addLog(`${handNames[attacker]}の「カノン」は本来加える本数が0のため記録されなかった。`);
        }
        power=0;
      }
      if(isRomanOpponentTarget(attacker,defender)){
        if(power!==0)addLog("ロマンギミック杯の準備時間中のため、相手へ加える本数は0になった。");
        power=0;
        state.lastAttackContext.receivedAmount=0;
        state.lastAttackContext.appliedAmount=0;
      }
      if(state.nobleGasProtected?.[defender]&&attacker!==defender){if(power!==0)addLog("通常攻撃は「貴ガス」に防がれた。");power=0;state.lastAttackContext.receivedAmount=0;state.lastAttackContext.appliedAmount=0;}
      const before = state[defender][targetHand];
      const romanOpponentHandProtected=isRomanOpponentTarget(attacker,defender);
      const total = before + power;
      const reducingAttack = power < 0;
      const overflowWouldApply = !romanOpponentHandProtected&&!reducingAttack && total >= 7 && hasAttachment(defender, targetHand, "overflowCurse");
      const guardWouldApply = !romanOpponentHandProtected&&!reducingAttack && total >= 5 && !overflowWouldApply && state.temp[defender].guard;
      const lightningZeroActive = !!state.temp[attacker].lightningZeroAtFive;
      const berserkerZeroActive = state.berserkerTurns[attacker] > 0;
      let resolvedFinal;

      if(romanOpponentHandProtected){
        // 準備時間中の対人攻撃は攻撃として解決するが、対象の手の値は計算経路へ渡さない。
        // power=0でも既存のwrap/超過処理へ通すと5以上のテスト状態が変化するため、盤面値をそのまま保持する。
        resolvedFinal=before;
      } else if (reducingAttack) {
        resolvedFinal = Math.max(0, total);
      } else if (state.activeDirectiveAnnihilation?.[attacker] && defender===otherPlayer(attacker) && total>=7) {
        resolvedFinal=0;
        addLog(`達成した「殲滅指令」により、${handNames[defender]}の${handNames[targetHand]}は7以上になったため0になった。`);
      } else if (berserkerZeroActive && total >= 7) {
        resolvedFinal = 0;
        addLog(`「バーサーカー」により、${handNames[defender]}の${handNames[targetHand]}は${total}になった時点で、超過処理をせず0になった。`);
      } else if (defender === otherPlayer(attacker) && hasMagicalCourage(attacker) && total >= 7) {
        resolvedFinal = 0;
        addLog(`「勇気」により、相手の手が7以上になったため超過計算をせず0になった。`);
      } else if (lightningZeroActive && total >= 5) {
        resolvedFinal = 0;
        addLog(`「雷撃」の充電Lv.10効果により、${handNames[defender]}の${handNames[targetHand]}は${total}になった時点で、超過計算をせず0になった。`);
      } else if (total >= 5 && hasAttachment(defender,targetHand,"sniperBlessing")) {
        resolvedFinal=0;
        addLog(`「狙撃の加護」により、${handNames[defender]}の${handNames[targetHand]}は5以上になったため0になった。`);
      } else {
        resolvedFinal = overflowWouldApply ? 0 : (guardWouldApply ? 4 : wrapFinger(total));
        if (overflowWouldApply) {
          addLog(`${handNames[defender]}の${handNames[targetHand]}の「超過の呪縛」により、7以上は0になる。`);
        }
      }

      // 成長は通常攻撃のraw resultが5になった瞬間、5→0などの盤面結果処理より先に発動する。
      if(!romanOpponentHandProtected)resolveGrowthBeforeFiveToZero(attacker,attackHand,total);

      state.temp[attacker].lightningZeroAtFive = false;

      // ここでいったん攻撃判定を反映する。罠破壊は攻撃判定後罠のあと。
      if(!romanOpponentHandProtected)resolvedFinal = await maybePreventLethalWithEmc2(defender, targetHand, resolvedFinal, "通常攻撃");
      await animateCalculation(defender, targetHand, total, resolvedFinal);
      state[defender][targetHand] = resolvedFinal;
      if(resonance&&hasAttachment(attacker,attackHand,"vibrationGeneration"))gainCharge(attacker,3,"振動発電");
      if(defender===otherPlayer(attacker)&&before>0&&resolvedFinal===0)state.temp[attacker].opponentZeroedThisTurn=true;
      if (guardWouldApply) state.temp[defender].guard = false;
      render();

      // 攻撃判定後：囮、踏み止まりなど。攻撃結果置換も同じ1攻撃1罠処理を使う。
      const afterTrapResult = await resolveAfterAttackTraps({attacker,attackHand,defender,targetHand,incomingPower:power,attackTotal:total,resolvedFinal,trapUsed,ignoresDefenderBoard});
      trapUsed = afterTrapResult.trapUsed;
      resolvedFinal = afterTrapResult.resolvedFinal;

      setLastAction(attacker, "攻撃", `${handNames[attackHand]}で${handNames[defender]}の${handNames[targetHand]}を攻撃。`, "action");

      addLog(
        `${handNames[attacker]}の${handNames[attackHand]}${basePower}本` +
        `${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ""}${berserkerBonus ? `+${berserkerBonus}` : ""}${blessingBonus ? `+${blessingBonus}` : ""}${recklessBonus ? `+${recklessBonus}` : ""}${resonanceBonus ? `+${resonanceBonus}` : ""}${cursePenalty ? `${cursePenalty}` : ""}${power !== Math.max(1, basePower + bonus + berserkerBonus + blessingBonus + recklessBonus + resonanceBonus + cursePenalty) ? `→${power}` : ""}で、` +
        `${handNames[defender]}の${handNames[targetHand]}を攻撃。` +
        `${before}→${total}${total >= 5 ? `→${resolvedFinal}` : ""}`
      );

      const finalTargetWasOpponent = defender === otherPlayer(attacker);
      const finalTargetWasZero = resolvedFinal === 0;

      if (selfRighteousActive && !finalTargetWasZero && state[attacker][attackHand] > 0) {
        await addFingersWithCalculation(attacker, attackHand, 2, "独善の反動");
      }

      if (justiceForEveryoneActive && finalTargetWasZero) {
        const rescueHand = otherHand(attackHand);
        const beforeRescue = state[attacker][rescueHand];
        state[attacker][rescueHand] = 1;
        addLog(`「みんなのための正義」により、${handNames[attacker]}の${handNames[rescueHand]}が${beforeRescue}→1になった。`);
        clearBrokenTraps(attacker);
        render();
      }

      if (rationalPowerActive && finalTargetWasOpponent && !isRomanPreparation()) {
        const splashHand = otherHand(targetHand);
        if (state[defender][splashHand] > 0) {
          await addFingersWithCalculation(defender, splashHand, power, "理性ある力", true);
          addLog(`「理性ある力」により、${handNames[defender]}の${handNames[splashHand]}にも同じ${power}本を与えた。`);
        }
      }

      if (hasAttachment(attacker,attackHand,"magicalHatred")) {
        await discardRandomCards(attacker,1,"「憎悪」");
      }
      if (!romanOpponentHandProtected&&hasAttachment(defender,targetHand,"magicalDespair")) {
        const other=otherHand(targetHand);
        if (isAlive(defender,other)) await addFingersWithCalculation(defender,other,1,"絶望");
      }
      if (hasAttachment(attacker,attackHand,"magicalLove")) {
        const other=otherHand(attackHand);
        if (state[attacker][other]===4) {
          state[attacker][other]=3;
          addLog(`「愛」により${handNames[attacker]}の${handNames[other]}が4→3。`);
        } else if (state[attacker][other]===1 || state[attacker][other]===2) {
          await addFingersWithCalculation(attacker,other,1,"愛");
        }
      }
      if (hasAttachment(attacker,attackHand,"magicalHappiness")) {
        drawCard(attacker); drawCard(attacker);
        const opponent = otherPlayer(attacker);
        if(!isRomanPreparation())await discardRandomCards(opponent,1,"「幸福」");
        addLog(`「幸福」により${handNames[attacker]}は2枚引いた。${isRomanPreparation()?"準備時間中のため相手の手札破棄は無効。":`${handNames[opponent]}はランダムに1枚捨てた。`}`);
      }

      await resolveResonanceRewards(attacker, attackHand, resonance);
      await resolveAfterAttackBlessings(attacker, attackHand, defender, targetHand, total, trapResult.cancelAttack);
      if(!isRomanOpponentTarget(attacker,defender))await resolveHarpoonAttackHit(attacker,attackHand,defender,targetHand,{resonance,isInternal:!!options.cardInternalAttack});
      if (typeof options.afterResolved === "function") {
        await options.afterResolved({ attacker, attackHand, defender, targetHand, power, total, finalValue: resolvedFinal });
      }

      // オンラインでは最終攻撃結果を勝敗通知より先に送る。
      // これにより、相手側でもトドメの計算・0化を確認してからリザルトへ進める。
      if (state.battleMode === "friend" && attacker === "human") {
        await emitFriendFx("attackResult", {
          defenderSide: friendSideForLocalPlayer(defender),
          targetHand,
          total,
          finalValue: state[defender][targetHand],
          source: "通常攻撃"
        });
        await forcePublishFriendStateNow("attack result");
      }

      // 捨て身などの攻撃後効果で両手が0になった場合は、ターン終了を待たず即座に勝敗を確定する。
      if (checkWin()) {
        state.animating = false;
        clearHighlights();
        render();
        await completeAttackAttempt();
        return true;
      }

      const damageChargeBlocked = !!state.temp[attacker].lightningNoChargeGain;
      if (!trapResult.cancelAttack && !damageChargeBlocked) {
        if (hasAttachment(attacker, attackHand, "mechanicalGeneration")) {
          gainCharge(attacker, power, "力学発電");
        }
        if (resolvedFinal === 0 && hasAttachment(attacker, attackHand, "bioticE")) {
          gainCharge(attacker, power * 2, "バイオティックE");
        }
      } else if (damageChargeBlocked) {
        addLog(`「雷撃」の効果により、この攻撃では力学発電・バイオティックEなどの充電獲得は発生しない。`);
      }
      state.temp[attacker].lightningNoChargeGain = false;

      clearBrokenTraps(defender);
      clearBrokenTraps(attacker);
      state.animating = false;
      clearHighlights();
      render();
      await completeAttackAttempt();
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
      if(player==="human"&&isFriendInteractionBlocking())return false;
      const before = `${state[player].L}-${state[player].R}`;
      if (show) {
        setLastAction(player, "分ける", "左右の本数を分け直しました。", "action");
        if (state.battleMode === "friend" && player === "human") {
          emitFriendFx("split", { playerSide: friendSideForLocalPlayer(player), left, right }).catch(error => console.error("PVP split fx failed", error));
        }
        await showPopup(player, "分ける", "左右の本数を分け直しました。", "action", player === "cpu" ? 650 : 500);
      }
      state[player].L = left;
      state[player].R = right;
      const usedExtraAction = consumeActiveExtraAction(player);
      if (usedExtraAction) state.pendingTerminalEnd[player] = true;
      if (state.temp[player]?.directiveActions) state.temp[player].directiveActions.splitUsed = true;
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

async function endTurn(reason="unspecified") {
      if(state.startingRouletteActive)return;
      if(isFriendInteractionBlocking())return false;
  const friendRollback=state.battleMode==="friend"&&state.friendRole?{snapshot:buildFriendCanonicalSnapshot(),meta:{turnSerial:state.friendTurnSerial,turnOwner:state.friendTurnOwner,turnStarted:state.friendTurnStarted,turnStartAppliedSerial:state.friendTurnStartAppliedSerial,turnStartToken:state.friendTurnStartToken,turnStartClaimedAt:state.friendTurnStartClaimedAtMs}}:null;
  const romanPreparationWasActive=isRomanPreparation();
  if (isTutorialBattle()) {
    freezeTutorialBattleToHumanTurn();
    return;
  }
  const endingPlayer=state.turn;
  vanishTurnEndCards(endingPlayer);
  state.cardLocks[endingPlayer]=(state.cardLocks[endingPlayer]||[]).map(lock=>({...lock,turnsRemaining:Number(lock.turnsRemaining||0)-1})).filter(lock=>lock.turnsRemaining>0);
  if(state.forcedCard[endingPlayer]?.active)state.forcedCard[endingPlayer]=null;
  if(state.pendingGungnirRecovery?.[endingPlayer]){
    state.pendingGungnirRecovery[endingPlayer]=false;
    await recoverHarpoon(endingPlayer,{sourceLabel:"グングニル"});
    if(checkWin()){render();return;}
  }
  state.activeExtraAction[endingPlayer]=false;
  state.extraActions[endingPlayer]=0;
  if(state.selectedTheme?.[endingPlayer]==="serenade"&&!state.resonanceTriggeredThisTurn?.[endingPlayer]&&getPerformanceLevel(endingPlayer)>0)changePerformanceLevel(endingPlayer,-1,"共鳴なしのターン終了");
  if((state.personalTurnCount?.[endingPlayer]||0)===1){for(let i=state.hands[endingPlayer].length-1;i>=0;i--)if(state.hands[endingPlayer][i]==="themeSetting"){state.hands[endingPlayer].splice(i,1);state.discard[endingPlayer].push("themeSetting");addLog(`${handNames[endingPlayer]}の未使用の「題目設定」が最初のターン終了時に消滅した。`);}}
  if(state.temp[endingPlayer]?.lightSpeedCircuit){ setChargeLevel(endingPlayer,0); state.temp[endingPlayer].lightSpeedCircuit=false; addLog(`${handNames[endingPlayer]}の「光速回路」が終了し、充電が0になった。`); }
      if (!hasCanonHitsDueForEndingPlayer(endingPlayer) && checkWin()) {
        render();
        return;
      }

      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingSwapFirst = null;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");

      await resolveDirectives(state.turn);
      if (!hasCanonHitsDueForEndingPlayer(endingPlayer) && checkWin()) {
        render();
        return;
      }

      await resolveEndTurnCurses(state.turn);
      if (!hasCanonHitsDueForEndingPlayer(endingPlayer) && checkWin()) {
        render();
        return;
      }

      await resolveCanonHitsForEndingPlayer(endingPlayer);
      if (checkWin()) { render(); return; }

      if (state.berserkerTurns[state.turn] > 0) state.berserkerTurns[state.turn] -= 1;
      state.activeCostLimit[state.turn] = null;
      state.activeIntemperanceCardLock[state.turn] = false;
      state.activeCardUseLockSource[state.turn] = "";
      if ((state.judgmentPrisonTurns?.[state.turn] || 0) > 0) state.judgmentPrisonTurns[state.turn] -= 1;
      state.noSplit[state.turn] = false;
      state.quarterRestActive[state.turn]=false;
      state.wholeRestActive[state.turn]=false;
      state.activeDrawLock[state.turn]=false;
      state.sforzandoTurnBonus[state.turn]=0;
      state.activeDirectiveReformContinue[state.turn]=false;
      state.activeDirectiveAnnihilation[state.turn]=false;
      const next = state.turn === "human" ? "cpu" : "human";
      if(romanPreparationWasActive&&!isRomanPreparation()){addLog("ロマンギミック杯：準備時間終了。戦闘開始。");setMessage("準備時間終了 ― 戦闘開始");}

      if (next === "cpu") {
        state.turn = "cpu";
        if (state.battleMode === "friend") {
          state.friendTurnSerial=Math.max(1,Number(state.friendTurnSerial||0)+1);
          state.friendTurnOwner=otherFriendRole(state.friendRole);
          state.friendTurnStarted=false;
          state.friendTurnStartToken=null;
          state.friendTurnStartClaimedAtMs=0;
          setMessage("相手の番です。同期を待っています。");
          render();
          try{
            const committed=await publishFriendStateNow();
            if(committed===false)throw new Error("handoff commit was not accepted");
          }catch(error){
            const failed={reason,local:{matchId:state.friendMatchId,friendRole:state.friendRole,turn:state.turn,turnSerial:state.friendTurnSerial,turnOwner:state.friendTurnOwner,turnStarted:state.friendTurnStarted,turnStartAppliedSerial:state.friendTurnStartAppliedSerial,turnStartToken:state.friendTurnStartToken,turnStartClaimedAt:state.friendTurnStartClaimedAtMs},remote:state.friendLastPublishRemoteMatch||null,payload:buildFriendCanonicalSnapshot(),error:{code:error?.code||"",message:error?.message||String(error)}};
            console.error("[friend-handoff-failed]",failed);
            if(friendRollback?.snapshot){const hydrated=state.friendSnapshotHydrated;state.friendSnapshotHydrated=false;await applyFriendCanonicalSnapshot(friendRollback.snapshot,0,friendRollback.meta);state.friendSnapshotHydrated=hydrated;state.friendLastPublishedSignature="";}
            setMessage("ターン交代を同期できませんでした。もう一度操作してください。");
            throw error;
          }
          return;
        }
        setMessage("CPUの番です。");
        render();
        await delay(450);
        await startTurn("cpu");
        if (state.turn !== "cpu" || state.gameOver || state.mode !== "attack") return;
        await delay(550);
        await cpuTurn();
      } else {
        state.turnNumber += 1;
        await startTurn("human");
      }
    }

    function localResultView(result) {
      if (result === "draw") return "draw";
      if (state.battleMode === "friend") return result === state.friendRole ? "win" : "lose";
      return result === "human" ? "win" : "lose";
    }

    function hideBattleResult() {
      if (!elements.battleResultModal) return;
      elements.battleResultModal.classList.remove("show", "win", "lose", "draw");
      elements.battleResultModal.setAttribute("aria-hidden", "true");
    }

    function showBattleResult(result) {
      if (!result || !elements.battleResultModal) return;
      const resultKey = `${state.battleMode}:${state.friendMatchId || state.turnNumber}:${result}`;
      if (state.lastShownResultKey === resultKey && elements.battleResultModal.classList.contains("show")) return;
      state.lastShownResultKey = resultKey;
      const view = localResultView(result);
      elements.battleResultModal.className = `battle-result-modal show ${view}`;
      elements.battleResultModal.setAttribute("aria-hidden", "false");
      elements.battleResultKicker.textContent = "MATCH RESULT";
      if (view === "win") {
        elements.battleResultTitle.textContent = "勝利！";
        elements.battleResultText.textContent = state.matchResultReason==="surrender" ? "相手の降参により勝利しました。" : "相手の両手を0にしました。";
      } else if (view === "lose") {
        elements.battleResultTitle.textContent = "敗北…";
        elements.battleResultText.textContent = state.matchResultReason==="surrender" ? "あなたは降参しました。" : "あなたの両手が0になりました。";
      } else {
        elements.battleResultTitle.textContent = "引き分け";
        elements.battleResultText.textContent = "同じ効果解決中に両者の両手が0になりました。";
      }
      updateBattleResultPostMatchView(state.friendRoomData?.postMatch);
    }

    function setSurrenderFlowOverlay(mode) {
      if (!elements.surrenderFlowOverlay) return;
      const showing = mode === "winner-notice" || mode === "surrender-wait";
      elements.surrenderFlowOverlay.classList.toggle("show", showing);
      elements.surrenderFlowOverlay.setAttribute("aria-hidden", String(!showing));
      if (!showing) return;
      elements.surrenderFlowKicker.textContent = mode === "winner-notice" ? "MATCH UPDATE" : "SYNCING RESULT";
      elements.surrenderFlowText.textContent = mode === "winner-notice" ? "相手が降参しました。" : "相手が結果を確認しています…";
      elements.surrenderFlowSub.textContent = mode === "winner-notice" ? "あなたの勝利です。" : "確認が終わるまでそのままお待ちください。";
    }

    async function acknowledgeFriendSurrenderNotice(matchId) {
      if (state.friendSurrenderAckWriting || !matchId || String(matchId) !== String(state.friendMatchId || "")) return false;
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId || !state.friendRole) return false;
      state.friendSurrenderAckWriting = true;
      try {
        const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
        const acknowledged = await fb.runTransaction(fb.db, async transaction => {
          const snap = await transaction.get(roomRef);
          if (!snap.exists()) return false;
          const room = snap.data() || {}, match = room.match || {};
          if (String(getFriendMatchId(match) || "") !== String(matchId) || room.status !== "playing") return false;
          if (match.resultReason !== "surrender" || match.state?.gameOver !== true || match.surrenderedBy === state.friendRole || match.result !== state.friendRole) return false;
          if (match.surrenderNoticeAcknowledged === true) return true;
          transaction.update(roomRef, {"match.surrenderNoticeAcknowledged": true, updatedAt: fb.serverTimestamp()});
          return true;
        });
        if (acknowledged && String(matchId) === String(state.friendMatchId || "")) {
          state.friendSurrenderNoticeAcknowledged = true;
          setSurrenderFlowOverlay(null);
          showBattleResult(state.matchResult);
        }
        return acknowledged;
      } finally {
        state.friendSurrenderAckWriting = false;
      }
    }

    async function runFriendSurrenderWinnerNotice(matchId) {
      if (!matchId || String(matchId) !== String(state.friendMatchId || "") || state.friendSurrenderNoticeAcknowledged === true) return;
      if (state.friendSurrenderNoticeRunning && state.friendSurrenderNoticeMatchId === matchId) return;
      state.friendSurrenderNoticeRunning = true;
      state.friendSurrenderNoticeMatchId = matchId;
      hideBattleResult();
      setSurrenderFlowOverlay("winner-notice");
      try {
        await delay(1800);
        if (String(matchId) !== String(state.friendMatchId || "") || state.matchResultReason !== "surrender" || state.friendSurrenderNoticeAcknowledged === true) return;
        setSurrenderFlowOverlay(null);
        await acknowledgeFriendSurrenderNotice(matchId);
      } catch (error) {
        console.error("PVP surrender notice acknowledgement failed", error);
        if (String(matchId) === String(state.friendMatchId || "")) {
          setSurrenderFlowOverlay("winner-notice");
          setMessage("降参結果の確認同期に失敗しました。再接続すると再試行します。");
        }
      } finally {
        if (state.friendSurrenderNoticeMatchId === matchId) state.friendSurrenderNoticeRunning = false;
      }
    }

    function applySyncedBattleResult(result, reason = null, surrenderedBy = null, noticeAcknowledged = null, matchId = state.friendMatchId) {
      if (!result) return;
      state.matchResult = result;
      state.matchResultReason = reason ?? state.matchResultReason ?? null;
      state.surrenderedBy = surrenderedBy ?? state.surrenderedBy ?? null;
      state.friendSurrenderNoticeAcknowledged = noticeAcknowledged;
      state.gameOver = true;
      const view = localResultView(result);
      if (state.battleMode === "friend" && state.matchResultReason === "surrender" && noticeAcknowledged !== true) {
        hideBattleResult();
        if (state.friendRole === state.surrenderedBy) {
          setSurrenderFlowOverlay("surrender-wait");
          setMessage("相手が結果を確認しています…");
        } else if (result === state.friendRole) {
          runFriendSurrenderWinnerNotice(matchId).catch(error => console.error("PVP surrender notice failed", error));
        }
        render();
        return;
      }
      setSurrenderFlowOverlay(null);
      setMessage(view === "win" ? "勝利！ 試合が終了しました。" : view === "lose" ? "敗北…。試合が終了しました。" : "引き分け。試合が終了しました。");
      render();
      showBattleResult(result);
    }

    async function initializeFriendPostMatchAsHost(result = state.matchResult) {
      if (state.battleMode !== "friend" || state.friendRole !== "host" || !state.friendRoomId || !state.friendMatchId || !result) return;
      if (state.matchResultReason === "surrender" && state.friendSurrenderNoticeAcknowledged !== true) return;
      const fb = firebaseApi();
      if (!fb) return;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.updateDoc(roomRef, {
        "postMatch.matchId": state.friendMatchId,
        "postMatch.hostChoice": null,
        "postMatch.guestChoice": null,
        "postMatch.resolvedAction": null,
        "postMatch.resolutionId": null,
        status: "lobby",
        hostReady: false,
        guestReady: false,
        "members.slot0.ready": false,
        "members.slot1.ready": false,
        updatedAt: fb.serverTimestamp()
      });
    }

    async function surrenderFriendMatch() {
      if(state.battleMode!=="friend"||state.currentScreen!=="battle"||state.gameOver||!state.friendMatchStarted||!state.friendRoomId||!state.friendMatchId||!state.friendRole||state.friendSurrenderBusy)return false;
      const fb=firebaseApi();if(!fb)return false;state.friendSurrenderBusy=true;
      try{
        const roomRef=fb.doc(fb.db,"rooms",state.friendRoomId),winner=otherFriendRole(),loser=state.friendRole;
        const result=await fb.runTransaction(fb.db,async transaction=>{
          const snap=await transaction.get(roomRef);if(!snap.exists())throw new Error("試合部屋が見つかりません。");
          const room=snap.data()||{},match=room.match||{},remoteMatchId=getFriendMatchId(match);
          if(room.status!=="playing"||String(remoteMatchId||"")!==String(state.friendMatchId||""))throw new Error("この試合は既に終了しています。");
          if(match.result||match.state?.gameOver)return {accepted:false,result:match.result||match.state?.result||null};
          const snapshot=cloneJson(match.state||buildFriendCanonicalSnapshot());snapshot.gameOver=true;snapshot.result=winner;snapshot.resultReason="surrender";snapshot.surrenderedBy=loser;
          transaction.update(roomRef,{"match.version":51,"match.stateRevision":Number(match.stateRevision||0)+1,"match.state":snapshot,"match.result":winner,"match.resultReason":"surrender","match.surrenderedBy":loser,"match.surrenderNoticeAcknowledged":false,updatedAt:fb.serverTimestamp()});
          return {accepted:true,result:winner};
        });
        if(result?.result){applySyncedBattleResult(result.result,"surrender",state.friendRole,false,state.friendMatchId);}
        return !!result?.accepted;
      }finally{state.friendSurrenderBusy=false;render();}
    }

    async function publishFriendResultNow(result) {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || !result || state.friendResultPublishing) return;
      const fb = firebaseApi();
      if (!fb) return;
      state.friendResultPublishing = true;
      try {
        const snapshot = buildFriendCanonicalSnapshot();
        if (!snapshot) return;
        snapshot.gameOver = true;
        snapshot.result = result;
        const nextRevision = Math.max(state.friendSyncRevision, state.friendLastAppliedRevision) + 1;
        state.friendSyncRevision = nextRevision;
        state.friendLastPublishedSignature = JSON.stringify(snapshot);
        const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
        const resultUpdate = {
          "match.version": 51,
          "match.stateRevision": nextRevision,
          "match.state": snapshot,
          "match.result": result,
          updatedAt: fb.serverTimestamp()
        };
        if (state.friendRole === "host") {
          Object.assign(resultUpdate, {
            "postMatch.matchId": state.friendMatchId,
            "postMatch.hostChoice": null,
            "postMatch.guestChoice": null,
            "postMatch.resolvedAction": null,
            "postMatch.resolutionId": null,
            status: "lobby",
            hostReady: false,
            guestReady: false,
            "members.slot0.ready": false,
            "members.slot1.ready": false
          });
        }
        await fb.runTransaction(fb.db,async transaction=>{const roomSnap=await transaction.get(roomRef);if(!roomSnap.exists())throw new Error("試合部屋が見つかりません。");const room=roomSnap.data()||{},match=room.match||{};if(String(getFriendMatchId(match)||"")!==String(state.friendMatchId||""))throw new Error("別の試合へ切り替わっています。");if(match.result||match.state?.gameOver)return;transaction.update(roomRef,resultUpdate);});
      } finally {
        state.friendResultPublishing = false;
      }
    }

    function checkWin() {
      if (isTutorialBattle()) {
        return false;
      }
      const humanDead = isDead("human");
      const cpuDead = isDead("cpu");
      if (!humanDead && !cpuDead) return false;

      let result;
      if (humanDead && cpuDead) result = "draw";
      else if (state.battleMode === "friend") result = cpuDead ? state.friendRole : otherFriendRole();
      else result = cpuDead ? "human" : "cpu";

      const isNewResult = !state.gameOver || state.matchResult !== result;
      state.gameOver = true;
      state.matchResult = result;
      if (isNewResult) {
        const view = localResultView(result);
        if (view === "win") {
          setMessage(state.battleMode === "friend" ? `勝利！ ${getPlayerDisplayName("cpu")}の両手を0にしました。` : "勝利！ CPUの両手を0にしました。");
          addLog("あなたの勝ち！");
        } else if (view === "lose") {
          setMessage("敗北…。あなたの両手が0になりました。");
          addLog(state.battleMode === "friend" ? `${getPlayerDisplayName("cpu")}の勝ち。` : "CPUの勝ち。");
        } else {
          setMessage("引き分け。両者の両手が0になりました。");
          addLog("引き分け。両者の両手が0になった。");
        }
        showBattleResult(result);
        if (state.battleMode === "friend") {
          publishFriendResultNow(result).catch(error => {
            console.error("PVP result publish failed", error);
            setMessage(`勝敗同期エラー：${error.message || error}`);
          });
        }
      }
      return true;
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
      const effectiveId=effectiveCardIdForPlayer("cpu",id);
      const card = CARD_LIBRARY[effectiveId];
      if (!card || isAttachmentCard(effectiveId) || !card.canPlay("cpu")) return -1;
      if (state.activeCostLimit.cpu !== null && card.cost > state.activeCostLimit.cpu) return -1;
      return index;
    }

    function wouldCpuWinByZeroing(hand) {
      return state.human[otherHand(hand)] === 0;
    }

    function estimateCpuNormalAttackPower(attackHand,targetHand,extraBonus=0) {
      const immutable=hasImmutableCurse("cpu",attackHand);
      const modifier=state.temp.cpu.attackBonus+extraBonus+(state.berserkerTurns.cpu>0?2:0)+(hasAttachment("cpu",attackHand,"powerBlessing")?1:0)+(hasAttachment("cpu",attackHand,"recklessBlessing")?2:0)-(hasAttachment("cpu",attackHand,"slowCurse")?1:0);
      const finalAttackPower=Math.max(1,state.cpu[attackHand]+(immutable?0:modifier));
      return Math.max(1,finalAttackPower-(hasAttachment("human",targetHand,"guardBlessing")?1:0));
    }

    function cpuBestAttackScoreAfterBonus(extraBonus = 0) {
      let best = null;
      for (const a of ["L", "R"].filter(h => isAlive("cpu", h))) {
        for (const t of ["L", "R"].filter(h => isAlive("human", h))) {
          const power = estimateCpuNormalAttackPower(a,t,extraBonus);
          const attackTotal = state.human[t] + power;
          const result = state.berserkerTurns.cpu > 0 && attackTotal >= 7 ? 0 : wrapFinger(attackTotal);
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
        if(!isExternallyDiscardableHandCard(cardId))return;
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
        if(!canUseCardUnderRule("cpu",cardId,{silent:true}))return;
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
      if (isTutorialBattle()) return false;
      if (state.activeIntemperanceCardLock?.cpu) return false;
      const circuitActive = !!state.temp.cpu.lightSpeedCircuit;
      if (state.temp.cpu.cardActionUsed && Number(state.temp.cpu.cardExtraUses||0)<=0 && !circuitActive) return false;
      if (state.berserkerTurns.cpu > 0 && !state.temp.cpu.berserkerJustUsed) return false;

      const cfg = cpuConfig();
      const profile = cpuDeckProfile();
      const candidates = [];

      const addCard = (id, score, note = "") => {
        if(!canUseCardUnderRule("cpu",id,{silent:true}))return;
        const index = cpuCanUseCardIndex(id);
        if (index >= 0) candidates.push({ id, index, score, note, action: async () => playCard("cpu", index, true) });
      };

      const bestNormal = cpuBestAttackScoreAfterBonus(0);
      const bestStrong = cpuBestAttackScoreAfterBonus(1);

      if (state.temp.cpu.lightSpeedCircuit) {
        state.hands.cpu.forEach((id, index) => {
          const card = CARD_LIBRARY[id];
          if (
            card?.chargeCard &&
            !isAttachmentCard(id) &&
            typeof card.effect === "function" &&
            id !== "lightSpeedCircuit" &&
            canUseChargeCardThisTurn("cpu", id) &&
            card.canPlay("cpu")
          ) {
            candidates.push({
              id,
              index,
              score: 180 + (card.cost || 0) * 12,
              note: "光速回路",
              action: async () => playCard("cpu", index, true)
            });
          }
        });
      }

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
      if (state.discard.cpu.some(id => CARD_LIBRARY[id]?.gun)) addCard("reload", 260 + profile.bulletBias * 310, "銃回収");
      if (state.hands.cpu.includes("rapidFire") && !state.hands.cpu.includes("logicCrusherBullet")) addCard("focusedShot", 420 + profile.bulletBias * 360, "必殺弾");
      if (CARD_LIBRARY.shotgun.canPlay("cpu")) addCard("shotgun", 300 + Math.max(...state.hands.cpu.map(gunAmmoPower), 0) * 80, "散弾射撃");
      if (CARD_LIBRARY.indiscriminateFire.canPlay("cpu")) addCard("indiscriminateFire", 120 + Math.max(...state.hands.cpu.map(gunAmmoPower), 0) * 35, "無差別射撃");
      if (state.hands.cpu.some(id => CARD_LIBRARY[id]?.bullet)) addCard("fanning", 260 + state.hands.cpu.filter(id => CARD_LIBRARY[id]?.bullet).length * 90, "連続射撃");
      if (CARD_LIBRARY.modulation.canPlay("cpu")) addCard("modulation", 120, "銃変調");
      addCard("themeSetting",900,"題目選択");
      addCard("encore",state.discard.cpu.includes("finale")?400:20,"アンコール");
      addCard("daCapo",state.cpu.L===0||state.cpu.R===0?700:130,"ダ・カーポ");
      addCard("fermata",220,"フェルマータ"); addCard("canon",260,"カノン"); addCard("quarterRest",240,"休符");
      addCard("agitato",190,"Agitato");
      addCard("doloroso",state.cpu.L>0||state.cpu.R>0?260:0,"Doloroso");
      addCard("lacrimosa",CARD_LIBRARY.lacrimosa.canPlay("cpu")?330:0,"Lacrimosa");
      addCard("morendo",180,"Morendo");
      addCard("grandioso",240,"Grandioso");
      addCard("portamento",220,"ポルタメント");
      addCard("presto",260,"プレスト");
      addCard("reinterpretation",180,"指令再解釈");
      addCard("naturalFaith",420,"指令一括達成");
      addCard("divineProof",760,"神意の証明");
      addCard("deusVult",10000,"DEUS VULT");
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
      const normalAttackAvailable=canUseNormalAttackAction("cpu");
      for (const a of (normalAttackAvailable?["L", "R"]:[]).filter(h => isAlive("cpu", h))) {
        for (const t of ["L", "R"].filter(h => isAlive("human", h))) {
          const power = estimateCpuNormalAttackPower(a,t);
          const attackTotal = state.human[t] + power;
          const result = state.berserkerTurns.cpu > 0 && attackTotal >= 7 ? 0 : wrapFinger(attackTotal);
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
      if (isTutorialBattle()) return;
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
      if (isTutorialBattle()) return;
      if (state.gameOver) return;

      let usedAction = await chooseCpuCardAction();
      if(state.turn!=="cpu"||state.gameOver)return;
      while(usedAction && usedAction!=="setup"&&!state.pendingTerminalEnd.cpu&&Number(state.temp.cpu.cardExtraUses||0)>0){
        setMessage("CPUが追加のカードを使用します。");render();await delay(300);
        const nextAction=await chooseCpuCardAction();
        if(state.turn!=="cpu"||state.gameOver)return;
        if(!nextAction)break;
        usedAction=nextAction;
      }

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

      if(await maybeAutoEndTurnForNoActions("cpu",{skipDelay:true}))return;

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
      const resolved = await resolveInternalNormalAttack({
        attackerPlayer: player,
        attackerHand: attackHand,
        targetPlayer: player,
        targetHand,
        sourceCardId: "cursedBullet",
        afterResolved: async ({ total }) => {
          if (total === 5) await resolveCursedBulletBonus(player);
        }
      });
      state.mode = "attack";
      state.pendingTerminalEnd[player] = true;
      render();
      return !!resolved;
    }

    async function resolveCursedBulletBonus(player) {
      if(isRomanPreparation()){addLog("「凶弾」の相手側追加効果は準備時間中のため無効。");return;}
      const opponent = otherPlayer(player);
      const targets = ["L", "R"].filter(hand => state[opponent][hand] > 0);
      addLog(`「凶弾」の追加効果。${handNames[opponent]}の1以上の手に3本ずつ加える。`);
      let bulletproofFxShown = false;
      for (const hand of targets) {
        if (isBulletproofVestBlocking(opponent, hand, "cursedBullet")) {
          await blockWithBulletproofVest(opponent, hand, "cursedBullet", "凶弾", !bulletproofFxShown);
          bulletproofFxShown = true;
          continue;
        }
        const before = state[opponent][hand];
        const amount = applyGuardBlessingReduction(opponent, hand, 3, "凶弾の追加効果");
        const total = before + amount;
        const finalValue = normalize(total, opponent, hand);
        await animateCalculation(opponent, hand, total, finalValue);
        state[opponent][hand] = finalValue;
        addLog(`${handNames[opponent]}の${handNames[hand]}：${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      }
      if (!targets.length) addLog("対象になる1以上の手がなかったため、凶弾の追加効果は不発。");
    }

    function canTriggerAgainstRapidFire(cardId) {
      return ["dodgeTrap", "deflect", "attention", "braceTrap", "baitTrap", "puddleTrap", "partingGift", "escapeDevice"].includes(cardId);
    }

    async function applyRapidFire(player, defender, discardIndex, targetHand) {
      if(isRomanPreparation()){if(player==="human")setMessage("「乱射」は準備時間中使用できません。");return false;}
      if (state[defender][targetHand] <= 0) return false;
      const cardId = state.hands[player][discardIndex];
      const ammo = CARD_LIBRARY[cardId];
      if (!ammo || !getRapidFireDiscardCandidates(player).some(item => item.index === discardIndex)) return false;

      if (await maybeUseNekodamashi(defender, { defender, targetHand, attacker: player, attackHand: null, incomingPower: 0, isRapidFire: true })) {
        addLog(`${handNames[player]}の乱射は「ねこだまし」で無効になった。`);
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        render();
        return true;
      }

      const discarded = await discardHandCardByEffect(player, discardIndex);
      state.pendingRapidFireExcludedIndex = null;

      if (discarded === "logicCrusherBullet") {
        state.animating = true;
        render();
        if (state.battleMode === "friend" && player === "human") {
          emitFriendFx("logicAtelier", {
            playerSide: friendSideForLocalPlayer(player),
            defenderSide: friendSideForLocalPlayer(defender),
            targetHand
          }).catch(error => console.error("PVP logic atelier fx failed", error));
        }
        const before = state[defender][targetHand];
        await showLogicAtelierFx(player, defender, targetHand);
        state[defender][targetHand] = 0;markDirectiveOpponentZero(player,defender,before);
        document.getElementById(`${defender}${targetHand}Num`).textContent = "0";
        document.getElementById(`${defender}${targetHand}Icons`).textContent = "";
        document.getElementById(`${defender}${targetHand}Calc`).textContent = "";
        addLog(`${handNames[player]}は「乱射」で「ロジックアトリエ」を捨て、${handNames[defender]}の${handNames[targetHand]}を${before}→0にした。罠は発動できない。`);
        clearBrokenTraps(defender);
        state.animating = false;
        clearHighlights();
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        render();
        return true;
      }

      if (await blockWithBulletproofVest(defender, targetHand, "rapidFire", "乱射")) {
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        clearHighlights();
        render();
        return true;
      }

      let damage = (ammo.cost || 0) + (ammo.bullet ? 1 : 0);
      if (damage <= 0) {
        addLog(`${handNames[player]}は「乱射」で「${ammo.name}」を捨てたが、ダメージは0だった。`);
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
        state.pendingTerminalEnd[player] = true;
        clearHighlights();
        render();
        return true;
      }

      // 乱射はsourceHandを持たないカード攻撃。対象変更後の最終対象に対して
      // receivedAmount（守護など）を計算し、罠はこの1撃につき1枚までとする。
      const finalAttackPower = damage;
      damage = applyGuardBlessingReduction(defender, targetHand, damage, "乱射");
      state.lastAttackContext = {attackKind:"card",attacker:player,sourceHand:null,defender,targetHand,basePower:(ammo.cost||0)+(ammo.bullet?1:0),attackModifier:finalAttackPower-((ammo.cost||0)+(ammo.bullet?1:0)),finalAttackPower,receivedAmount:damage,isAttackReplacement:false,isNormalAttack:false,isCardAttack:true,sourceCardId:"rapidFire"};

      const before = state[defender][targetHand];
      const total = before + damage;
      const lightningZeroActive = !!state.temp[player].lightningZeroAtFive;
      let resolvedFinal;

      if (lightningZeroActive && total >= 5) {
        resolvedFinal = 0;
        addLog(`「雷撃」の充電Lv.10効果により、${handNames[defender]}の${handNames[targetHand]}は${total}になった時点で、超過計算をせず0になった。`);
      } else {
        resolvedFinal = normalize(total, defender, targetHand);
      }

      state.temp[player].lightningZeroAtFive = false;
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
      const discarded = await discardHandCardByEffect("human", index);
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
      if (!cardId || !getRapidFireDiscardCandidates("human").some(item => item.index === index)) {
        setMessage("乱闘でコピー元になった乱射自身や、捨てられないカードは選べません。");
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
      const discarded = await discardHandCardByEffect("human", index);
      state.pendingRepairDiscard = discarded;
      state.mode = "repair";
      setMessage(`「${CARD_LIBRARY[discarded].name}」を捨てました。次に1に戻す0の手を選んでください。`);
      render();
    }

    async function resolveActionDone() {
      if (isTutorialBattle()) {
        freezeTutorialBattleToHumanTurn();
        return;
      }
      const player = state.turn;
      const attackLimit = Number(state.temp[player]?.attackLimit ?? 1);
      const attacksUsed = state.temp[player]?.attacksUsed || 0;
      const extraActionJustConsumed = !!state.temp[player]?.extraActionJustConsumed;
      state.temp[player].extraActionJustConsumed = false;

      if(!extraActionJustConsumed&&state.activeDirectiveReformContinue?.[player]&&state.temp[player]?.directiveActions?.splitUsed&&!checkWin()){
        state.activeDirectiveReformContinue[player]=false;
        state.mode="attack";
        elements.splitBox.classList.remove("active");
        setMessage("達成した「再編成指令」により、分けた後もターンを続行できます。");
        render();
        return;
      }

      if (!extraActionJustConsumed &&
        attackLimit > 1 &&
        attacksUsed > 0 &&
        attacksUsed < attackLimit &&
        !checkWin()
      ) {
        state.selectedAttackHand = null;
        state.mode = "attack";
        elements.splitBox.classList.remove("active");
        elements.andanteBox?.classList.remove("active");
        const multiAttackSource = state.temp[player]?.multiAttackSource || "追加攻撃";
        setMessage(
          `${handNames[player]}は「${multiAttackSource}」により、もう一度攻撃できます。攻撃に使う手を選んでください。`
        );
        addLog(
          `${handNames[player]}の「${multiAttackSource}」：` +
          `${attacksUsed}回目の攻撃が終了。残り${attackLimit - attacksUsed}回攻撃できる。`
        );
        render();

        if (player === "cpu") {
          await delay(500);
          const attacks = [];
          for (const a of ["L", "R"]) {
            if (state.cpu[a] <= 0) continue;
            for (const t of ["L", "R"]) {
              if (state.human[t] > 0) attacks.push({ a, t });
            }
          }
          if (attacks.length) {
            const picked = attacks[Math.floor(Math.random() * attacks.length)];
            await attack("cpu", picked.a, "human", picked.t);
            await delay(300);
            await resolveActionDone();
          } else {
            await endTurn();
          }
        }
        return;
      }

      if (state.extraActions[state.turn] > 0 && !checkWin()) {
        state.activeExtraAction[state.turn] = true;
        state.pendingTerminalEnd[state.turn] = false;
        state.selectedAttackHand = null;
        state.mode = "attack";
        elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
        setMessage(`${handNames[state.turn]}は追加行動できます。もう一度、攻撃か分けるを選んでください。`);
        render();
        if (!canUseNormalAttackAction(state.turn) && !canUseSplitAction(state.turn)) {
          addLog(`${handNames[state.turn]}は追加行動を行える選択肢がないため、追加行動を終了した。`);
          consumeActiveExtraAction(state.turn);
          await endTurn();
          return;
        }
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
      if (state.battleMode === "friend" && player === "human") {
        await emitFriendFx("randomDice", {
          playerSide: friendSideForLocalPlayer(player),
          hand,
          before,
          result: next
        });
      }
      addLog(`${handNames[player]}は「ランダムダイス」で${handNames[hand]}を${before}→${next}にした。`);
      setLastAction(player, "ランダムダイス", `${handNames[hand]}が${before}→${next}になりました。`, "card");
      clearBrokenTraps(player);
      state.highlight = null;
      if (player === "human") {
        state.mode = "attack";
        setMessage(`「ランダムダイス」：${handNames[hand]}が${before}→${next}になりました。まだ攻撃か分けるができます。`);
      }
      render();
      if (state.battleMode === "friend" && player === "human") {
        // 選択式カードは playCard() 終了時点では未確定なので、結果確定後に明示同期する。
        await publishFriendStateNow();
      }
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

    async function applyEqualTradeOpponent(player, opponent, hand) {
      if (state[opponent][hand] < 2) return false;
      state[opponent][hand] = Math.max(0, state[opponent][hand] - 1);
      clearBrokenTraps(opponent);
      addLog(`${handNames[player]}は「等価交換」で、自分の${handNames[state.pendingEqualTradeSelf] || "手"}と${handNames[opponent]}の${handNames[hand]}を-1した。`);
      state.pendingEqualTradeSelf = null;
      state.mode = "attack";
      setMessage(`「等価交換」：相手の${handNames[hand]}を-1しました。まだ攻撃か分けるができます。`);
      render();
      if (player === "human") await forcePublishFriendStateNow("equal trade");
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

    async function applyAndanteDelta(delta) {
      const hand = state.pendingAndanteHand;
      if (!hand || state.mode !== "andante") return false;
      const before = state.human[hand];
      const next = before + delta;
      if (next <= 0 || next > 4) {
        setMessage("アンダンテでは0以下や5以上にはできません。");
        return false;
      }
      state.human[hand] = next;
      state.pendingAndanteHand = null;
      state.mode = "attack";
      elements.andanteBox.classList.remove("active");
      addLog(`あなたは「アンダンテ」で${handNames[hand]}を${before}→${next}に微調整した。`);
      setMessage(`「アンダンテ」：${handNames[hand]}を${before}→${next}にしました。まだ攻撃か分けるができます。`);
      render();
      await forcePublishFriendStateNow("andante");
      return true;
    }

    async function onHandClickCore(event) {
      if(state.startingRouletteActive)return;
      const card = event.currentTarget;
      const owner = card.dataset.owner;
      const hand = card.dataset.hand;
      if(isFriendInteractionBlocking())return;

      if (!tutorialExpectedHand(owner, hand)) return;
      if (tutorial.usingRealBattle && state.battleMode === "tutorial") tutorialAfterHandClick(owner, hand);

      if (state.gameOver || state.animating || state.turn !== "human") return;

      if (state.mode === "boardHandSelection") {
        if (!finishBoardHandSelection(owner, hand)) setMessage("ハイライトされた手を選んでください。");
        return;
      }

      if(state.mode==="portamentoSource"){
        if(owner!=="human"||state.human[hand]<=0){setMessage("ポルタメント：自分の0ではない手を選んでください。");return;}
        await resolvePortamento("human",hand);return;
      }

      if(state.mode==="dissonanceSource"){
        if(owner!=="human"||state.human[hand]<=0){setMessage("ディソナンス：攻撃に使う自分の0ではない手を選んでください。");return;}
        await resolveDissonance("human",hand);return;
      }

      if(state.mode==="sforzandoTarget"){
        if(!["human","cpu"].includes(owner)||state[owner][hand]<=0){setMessage("スフォルツァント：0ではない手を選んでください。");return;}
        resolveSforzando("human",owner,hand);return;
      }

      if(state.mode==="arpeggioSource"){
        if(owner!=="human"||state.human[hand]<=0){setMessage("アルペジオ：自分の0ではない手を選んでください。");return;}
        const total=state.human[hand],allocation=await showNumberAllocation({title:`アルペジオ：${total}本を相手の左右へ割り振ってください。`,total}),left=allocation.left;
        if(!Number.isInteger(left)||left<0||left>total){setMessage("分配が不正なため選び直してください。");return;}
        await resolveArpeggio("human",hand,left);if(!state.gameOver){state.pendingTerminalEnd.human=false;await endTurn();}return;
      }

      if (state.mode === "fanningTarget") {
        if (owner !== "cpu" || state.cpu[hand] <= 0 || !state.pendingFanning) {
          setMessage("「ファニング」：相手の0ではない手を選んでください。");
          return;
        }
        const shots = state.pendingFanning.shots;
        await resolveFanning("human", hand, shots);
        if (!state.gameOver && state.turn === "human") {
          state.pendingTerminalEnd.human = false;
          await endTurn();
        }
        return;
      }

      if (state.mode === "arcanaSlaveTarget") {
        if (owner !== "cpu" || state.cpu[hand] <= 0) {
          setMessage("「アルカナ・スレイブ！！」：相手の0ではない手を選んでください。");
          return;
        }
        if (state.battleMode === "friend") {
          await emitFriendFx("arcanaSlave", {
            playerSide: friendSideForLocalPlayer("human"),
            targetSide: friendSideForLocalPlayer("cpu"),
            targetHand: hand
          });
        }
        await showArcanaSlaveCinematic("human");
        await showArcanaTargetCircle("cpu", hand);
        const before=state.cpu[hand];state.cpu[hand] = 0;markDirectiveOpponentZero("human","cpu",before);
        clearBrokenTraps("cpu");
        state.mode = "attack";
        state.pendingTerminalEnd.human = true;
        addLog(`あなたの「アルカナ・スレイブ！！」が相手の${handNames[hand]}を0にした。`);
        setMessage("「アルカナ・スレイブ！！」が発動しました。");
        render();
        await forcePublishFriendStateNow("arcana slave final state");
        checkWin();
        if (!state.gameOver && state.turn === "human") {
          state.pendingTerminalEnd.human = false;
          await endTurn();
        } else if (state.battleMode === "friend") {
          scheduleFriendStatePublish();
        }
        return;
      }

      if (state.mode === "tuningTarget") {
        if(owner!=="human"||state.human[hand]<=0){setMessage("自分の0ではない手を選んでください。");return;}
        const other=otherHand(hand), before=state.human[hand]; state.human[hand]=state.human[other]; clearBrokenTraps("human"); state.mode="attack"; addLog(`あなたは「調律」で${handNames[hand]}を${before}→${state.human[hand]}にした。`); render(); await forcePublishFriendStateNow("tuning"); return;
      }
      if (state.mode === "fairWorldTarget") {
        if(owner!=="human"||state.human[hand]<=0){setMessage("自分の0ではない手を選んでください。");return;} await resolveFairWorld("human",hand); if(!state.gameOver){state.pendingTerminalEnd.human=false;await endTurn();} return;
      }
      if (state.mode === "executionTarget") {
        if(owner!=="cpu"||state.cpu[hand]<=0){setMessage("相手の0ではない手を選んでください。");return;}
        if (state.battleMode === "friend") {
          await emitFriendFx("executionStrike", {
            playerSide: friendSideForLocalPlayer("human"),
            targetSide: friendSideForLocalPlayer("cpu"),
            targetHand: hand
          }).catch(error => console.error("PVP execution strike fx failed", error));
        }
        await showExecutionTargetSeal("cpu", hand);
        const before=state.cpu[hand];state.cpu[hand]=0;markDirectiveOpponentZero("human","cpu",before); clearBrokenTraps("cpu"); state.mode="attack"; state.pendingTerminalEnd.human=true; addLog(`あなたの「執行」により相手の${handNames[hand]}が0になった。`); render(); await forcePublishFriendStateNow("execution target"); checkWin(); if(!state.gameOver){state.pendingTerminalEnd.human=false;await endTurn();} return;
      }

      if (state.mode === "magicalWithLove") {
        if (owner !== "human") {
          setMessage("自分の手を選んでください。");
          return;
        }
        const before = state.human[hand];
        state.human[hand] = 2;
        clearBrokenTraps("human");
        drawCard("human");
        state.mode = "attack";
        addLog(`あなたは「愛で！」で${handNames[hand]}を${before}→2にし、1枚引いた。`);
        setMessage(`「愛で！」：${handNames[hand]}を2にして1枚引きました。`);
        render();
        await forcePublishFriendStateNow("with love");
        return;
      }

      if (state.mode === "magicalBetrayedHeart") {
        if (owner !== "human" || state.human[hand] <= 0) {
          setMessage("自分の0でない手を選んでください。");
          return;
        }
        await addFingersWithCalculation("human", hand, 1, "裏切られた心");
        state.mode = "attack";
        setMessage("「裏切られた心」：手を1本増やしました。このターン、通常攻撃で加える本数-1。");
        render();
        await forcePublishFriendStateNow("betrayed heart");
        return;
      }

      if (state.mode === "dimensionalSlashSacrifice") {
        state.animating = false;
        if (owner !== "human") {
          setMessage("「空間切断」：0にする自分の手を選んでください。");
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("「空間切断」：すでに0の手は選べません。");
          return;
        }

        const before = state.human[hand];
        const resolved = await resolveDimensionalSlash("human", hand);
        if (resolved) {
          addLog(`「空間切断」：代償処理が完了し、攻撃強化と2回攻撃が有効になった。`);
          setMessage(`「空間切断」：${handNames[hand]}を${before}→0。攻撃+1、通常攻撃を2回まで行えます。`);
        }
        return;
      }

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
        addLog(`あなたは「補修」で${discarded ? `「${CARD_LIBRARY[discarded].name}」を捨て、` : ""}${handNames[hand]}を0→1に戻した。`);
        setMessage(`「補修」：${handNames[hand]}を1に戻しました。まだ攻撃か分けるができます。`);
        render();
        await forcePublishFriendStateNow("repair");
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
        await applyEqualTradeOpponent("human", "cpu", hand);
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

      if (state.mode === "chargeTargetOwn" || state.mode === "chargeTargetOpponent") {
        const pending = state.pendingChargeTarget;
        if (!pending || pending.player !== "human") {
          state.mode = "attack";
          state.pendingChargeTarget = null;
          render();
          return;
        }
        const expectedOwner = state.mode === "chargeTargetOwn" ? "human" : "cpu";
        if (owner !== expectedOwner || state[owner][hand] <= 0) {
          setMessage(`「${CARD_LIBRARY[pending.cardId].name}」：0でない${expectedOwner === "human" ? "自分" : "相手"}の手を選んでください。`);
          return;
        }
        await resolveChargeTargetEffect("human", owner, hand, pending.cardId);
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
        if (!await applyMoveOne("human", hand)) {
          setMessage("その手からは移せません。もう片方の手を選んでください。");
        }
        return;
      }

      if (state.mode === "andante") {
        if (owner !== "human") {
          setMessage("アンダンテでは自分の手を選んでください。");
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("0の手は選べません。");
          return;
        }
        state.pendingAndanteHand = hand;
        elements.andanteLabel.textContent = `アンダンテ：${handNames[hand]} ${state.human[hand]}本`;
        elements.andanteMinusBtn.disabled = state.human[hand] <= 1;
        elements.andantePlusBtn.disabled = state.human[hand] >= 4;
        elements.andanteBox.classList.add("active");
        setMessage(`「アンダンテ」：${handNames[hand]}を+1するか-1するか選んでください。`);
        render();
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
        if(!canUseNormalAttackAction("human")){
          setMessage("このターンは通常攻撃できません。");
          return;
        }
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

    async function onHandClick(event) {
      await onHandClickCore(event);
      // 旧式の盤面選択解決も、通常行動へ戻った後に同じ共通判定へ合流させる。
      // Promise型カードの継続処理を先に再開させるため、次のtaskで確認する。
      if (state.mode === "attack" && !state.gameOver) {
        setTimeout(() => {
          maybeAutoEndTurnForNoActions(state.turn).catch(error => console.error("auto end after hand selection failed", error));
        }, 0);
      }
    }

    function resetGame() {
      const humanDeck = buildDeckFromCounts("human");
      const cpuDeck = buildDeckFromCounts("cpu");
      const humanHasThemeSetting = extractThemeSettingFromOpeningDeck(humanDeck);
      const cpuHasThemeSetting = extractThemeSettingFromOpeningDeck(cpuDeck);

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
      state.temp.human = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0,naturalFaithActive:false,opponentZeroedThisTurn:false,chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.temp.cpu = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, attacksOccurredThisTurn:0,naturalFaithActive:false,opponentZeroedThisTurn:false,chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingRepairDiscard = null;
      state.revealedTrapIds = new Set();
      state.noSplit = { human: false, cpu: false };
      state.extraActions = { human: 0, cpu: 0 };
      state.activeExtraAction = { human: false, cpu: false };
      state.pendingAcceleration = { human: 0, cpu: 0 };
      state.activeAcceleration = { human: 0, cpu: 0 };
      state.pendingNoDraw = { human: 0, cpu: 0 };
      state.activeNoDraw = { human: 0, cpu: 0 };
      state.pendingTerminalEnd = { human: false, cpu: false };
      state.pendingIntemperanceCardLock = { human: false, cpu: false };
      state.activeIntemperanceCardLock = { human: false, cpu: false };
      state.pendingCardUseLockSource = { human: "", cpu: "" };
      state.activeCardUseLockSource = { human: "", cpu: "" };
      state.judgmentPrisonTurns = { human: 0, cpu: 0 };
      state.pendingAppealExecution = { human: 0, cpu: 0 };
      state.personalTurnCount = { human: 0, cpu: 0 };
      state.pendingMagicalHeartDraw = { human: 0, cpu: 0 };
      state.magicalChantProgress = { human: 0, cpu: 0 };
      state.magicalChantCompleted = { human: false, cpu: false };
      state.costLimitNextTurn = { human: null, cpu: null };
      state.activeCostLimit = { human: null, cpu: null };
      state.berserkerTurns = { human: 0, cpu: 0 };
      state.pendingEqualTradeSelf = null;
      state.pendingRapidFireDiscard = null;
      state.pendingGunEffect = null;
      state.pendingFanning = null;
      state.pendingModulation = null;
      state.pendingStartDrawSkip = { human: false, cpu: false };
      state.selectedTheme = { human: null, cpu: null };
      state.performanceLevel = { human: 0, cpu: 0 };
      state.resonanceTriggeredThisTurn = { human: false, cpu: false };
      state.usedRondoFamilies = { human: [], cpu: [] };
      state.usedRondoCards = { human: [], cpu: [] };
      state.pendingDrawLock = { human: false, cpu: false };
      state.activeDrawLock = { human: false, cpu: false };
      state.pendingPrestoAttack = { human: false, cpu: false };
      state.sforzandoTurnBonus = { human: 0, cpu: 0 };
      state.pendingCanonHits = [];
      state.pendingYellowWaspNeedle = { human:false,cpu:false };
      state.pendingGungnirRecovery = { human:false,cpu:false };
      state.quarterRestPending = { human: 0, cpu: 0 };
      state.quarterRestActive = { human: false, cpu: false };
      state.wholeRestPending = { human: false, cpu: false };
      state.wholeRestActive = { human: false, cpu: false };
      state.pendingArpeggio = null;
      state.furiosoSkipPending = { human: false, cpu: false };
      state.furiosoSkipActive = { human: false, cpu: false };
      state.pendingSwapFirst = null;
      state.pendingChargeStun = { human: false, cpu: false };
      state.pendingChargeStunSource = { human: "", cpu: "" };
      state.cheapBatteryDecay = { human: 0, cpu: 0 };
      state.energyBarrier = { human: 0, cpu: 0 };
      state.pendingChargeTarget = null;
      state.pendingAdvanceNotice = { human: [], cpu: [] };
      resetDirectiveMatchState();
      state.lightSpeedCircuitUsed = { human: false, cpu: false };
      state.pendingAndanteHand = null;
      state.pendingBalanceTarget = null;
      state.firstTurnStarted = { human: false, cpu: false };
      state.weaknessWait = {};
      state.highlight = null;
      state.lastAction = null;
      state.startingFlowToken=Number(state.startingFlowToken||0)+1;
      state.startingPlayer=null;
      state.startingPlayerDecided=false;
      state.startingRouletteActive=false;
      state.turn = "human";
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.animating = false;
      state.gameOver = false;
      state.matchResult = null;
      state.matchResultReason = null;
      state.lastShownResultKey = null;
      hideBattleResult();
      state.log = [];
      state.turnNumber = 1;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      clearHighlights();

      addLog("新しい対戦を開始しました。");
      for (let i = 0; i < 3; i++) {
        drawCard("human");
        drawCard("cpu");
      }
      if (humanHasThemeSetting) state.hands.human.push("themeSetting");
      if (cpuHasThemeSetting) state.hands.cpu.push("themeSetting");
      renderDeckBuilder();
      if(state.battleMode==="cpu"&&state.currentScreen==="battle")return beginCpuStartingFlow();
      render();
      return Promise.resolve(null);
    }

    if (elements.battleResultViewBtn) {
      elements.battleResultViewBtn.addEventListener("click", hideBattleResult);
    }
    if (elements.battleResultReopenBtn) {
      elements.battleResultReopenBtn.addEventListener("click", () => {
        if (state.matchResult) showBattleResult(state.matchResult);
      });
    }
    if(elements.friendSurrenderBtn){
      elements.friendSurrenderBtn.addEventListener("click",async()=>{
        if(state.battleMode!=="friend"||state.gameOver||state.friendSurrenderBusy)return;
        const confirmed=await requestSocialConfirmation("降参しますか？","降参すると、この試合はあなたの敗北になります。",{okLabel:"降参する",cancelLabel:"キャンセル"});
        if(!confirmed||state.gameOver||state.friendSurrenderBusy)return;
        try{await surrenderFriendMatch();}catch(error){console.error("PVP surrender failed",error);setMessage(`降参の同期に失敗しました：${error.message||error}`);}
      });
    }
    if (elements.battleResultRematchBtn) {
      elements.battleResultRematchBtn.addEventListener("click", () => requestFriendPostMatchChoice("rematch").catch(error => {
        console.error(error);
        setMessage(`再戦同期エラー：${error.message || error}`);
      }));
    }
    if (elements.battleResultDeckBtn) {
      elements.battleResultDeckBtn.addEventListener("click", () => requestFriendPostMatchChoice("deck").catch(error => {
        console.error(error);
        setMessage(`デッキ変更同期エラー：${error.message || error}`);
      }));
    }
    if (elements.battleResultLobbyBtn) {
      elements.battleResultLobbyBtn.addEventListener("click", () => requestFriendPostMatchChoice("lobby").catch(error => {
        console.error(error);
        setMessage(`ロビー復帰同期エラー：${error.message || error}`);
      }));
    }

    document.querySelectorAll(".hand").forEach(card => {
      card.addEventListener("click", onHandClick);
    });

    elements.menuTutorialBtn?.addEventListener("click", openTutorialMenu);
    elements.realTutorialOkBtn?.addEventListener("click", () => {
      if (!isTutorialBattle() || tutorial.expected !== "ok") return;
      tutorial.step++;
      renderRealTutorialStep();
    });
    elements.realTutorialRetryBtn?.addEventListener("click", () => startTutorialChapter(tutorial.chapter));
    elements.realTutorialChaptersBtn?.addEventListener("click", () => {
      tutorial.usingRealBattle = false;
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      elements.realTutorialOverlay.classList.add("hidden");
      openTutorialMenu();
    });
    elements.tutorialExitBtn?.addEventListener("click", () => {
      tutorial.usingRealBattle = false;
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      elements.realTutorialOverlay?.classList.add("hidden");
      showScreen("menu");
    });
    elements.tutorialBackToChaptersBtn?.addEventListener("click", openTutorialMenu);
    elements.tutorialRestartChapterBtn?.addEventListener("click", () => startTutorialChapter(tutorial.chapter));

    [elements.tutorialHumanL, elements.tutorialHumanR, elements.tutorialCpuL, elements.tutorialCpuR].forEach(element => {
      element?.addEventListener("click", () => tutorialHandleHand(element.dataset.owner, element.dataset.hand, element));
    });

    elements.tutorialSplitBtn?.addEventListener("click", () => {
      if (tutorial.chapter !== 2 || tutorial.step !== 0) return;
      tutorialAdvance();
    });
    elements.tutorialSplitPanel?.querySelectorAll("[data-split]").forEach(button => {
      button.addEventListener("click", () => {
        if (tutorial.chapter !== 2 || tutorial.step !== 1 || button.dataset.split !== "1,1") return;
        tutorialAdvance();
      });
    });

    elements.tutorialChoiceYesBtn?.addEventListener("click", () => {
      if (tutorial.chapter !== 4 || tutorial.step !== 2) return;
      tutorialMessage("空振りが発動", "攻撃を無効にしました。手動罠は、発動するか温存するかを選べます。", "攻撃を無効化");
      elements.tutorialChoicePanel.classList.add("hidden");
      elements.tutorialNextBtn.textContent = "次へ";
      elements.tutorialNextBtn.classList.remove("hidden");
      tutorialHighlight(elements.tutorialNextBtn);
    });
    elements.tutorialChoiceNoBtn?.addEventListener("click", () => {
      if (tutorial.chapter === 4 && tutorial.step === 2) {
        tutorialMessage("今回は発動しましょう", "空振りの体験なので、「発動する」を選んでください。");
      }
    });

    elements.tutorialNextBtn?.addEventListener("click", () => {
      if (tutorial.chapterComplete) {
        const next = tutorial.chapter + 1;
        if (next <= 5) startTutorialChapter(next);
        else openTutorialMenu();
        return;
      }
      if (tutorial.chapter === 2 && tutorial.step === 2) { tutorialAdvance(); return; }
      if (tutorial.chapter === 3 && tutorial.step === 0) { tutorialAdvance(); return; }
      if (tutorial.chapter === 3 && tutorial.step === 7) { tutorialAdvance(); return; }
      if (tutorial.chapter === 4 && tutorial.step === 2) { tutorialAdvance(); return; }
      if (tutorial.chapter === 4 && tutorial.step === 5) { tutorialAdvance(); return; }
      if (tutorial.chapter === 5 && tutorial.step === 4) { tutorialAdvance(); return; }
    });

    elements.tutorialWelcomeStartBtn?.addEventListener("click", () => {
      tutorialSetWelcomeSeen();
      closeTutorialWelcome();
      openTutorialMenu();
    });
    elements.tutorialWelcomeLaterBtn?.addEventListener("click", () => {
      tutorialSetWelcomeSeen();
      closeTutorialWelcome();
      showMajorUpdateAfterTutorialWelcome();
    });
    elements.tutorialWelcomeSkipBtn?.addEventListener("click", () => {
      tutorialSetWelcomeSeen();
      closeTutorialWelcome();
      showMajorUpdateAfterTutorialWelcome();
    });

    elements.menuStartBtn.addEventListener("click", () => {
      tutorial.usingRealBattle = false;
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      elements.realTutorialOverlay?.classList.add("hidden");
      showScreen("battleSelect");
    });
    function renderCpuRegulationOptions(){
      if(!elements.cpuRegulationSelect)return;
      elements.cpuRegulationSelect.replaceChildren(...Object.values(REGULATION_DEFS).map(rule=>{
        const option=document.createElement("option");option.value=rule.id;option.textContent=rule.name;return option;
      }));
      elements.cpuRegulationSelect.value="standard";
    }
    renderCpuRegulationOptions();
    elements.plVsCpuBtn.addEventListener("click", () => {elements.cpuRegulationSelect.value="standard";state.currentRegulation={...DEFAULT_REGULATION};showScreen("difficulty");});
    elements.plVsPlBtn.addEventListener("click", () => {
      showScreen("friendLobby");
      updateFriendLobbyView();
      updateFriendAuthUi();
    });
    elements.battleSelectBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.friendLobbyBackBtn.addEventListener("click", () => state.friendRoomId ? leaveFriendRoom().catch(error=>elements.friendLobbyMessage.textContent=friendFirestoreErrorMessage(error,"退出できませんでした。")) : showScreen("battleSelect"));
    elements.battleRoomLeaveBtn?.addEventListener("click",()=>leaveFriendRoom().catch(error=>elements.friendLobbyMessage.textContent=friendFirestoreErrorMessage(error,"退出できませんでした。")));
    elements.battleRoomDeckEditBtn?.addEventListener("click",async()=>{
      const readyKey=state.friendRole==="host"?"hostReady":"guestReady";
      try{if(state.friendRoomId&&state.friendRoomData?.[readyKey]===true)await setFriendReady(false);}
      catch(error){elements.friendLobbyMessage.textContent=friendFirestoreErrorMessage(error,"準備解除に失敗したため、デッキ編集を開始できませんでした。");return;}
      state.friendDeckEditReturnToLobby=true;state.editingDeckOwner="human";state.deckRuleContext={ruleId:state.friendRoomData?.regulation?.modeId||"standard"};showScreen("deck");
    });
    document.getElementById("battleRoomRuleDetailBtn")?.addEventListener("click",()=>openRuleDetail(state.friendRoomData?.regulation?.modeId||"standard"));
    document.getElementById("ruleDetailCloseBtn")?.addEventListener("click",()=>socialClose("ruleDetailModal"));
    elements.battleRoomOpponentCard?.addEventListener("click",()=>{
      const member=roomMember(state.friendRoomData,otherFriendRole());
      if(member?.registered&&member.publicId)openSocialProfile({uid:member.uid,displayName:member.displayName,publicId:member.publicId,bannerId:member.bannerId||"",titleId:member.titleId||""});
    });
    elements.createRoomBtn.addEventListener("click",openRoomCreateSettings);
    document.getElementById("roomCreateConfirmBtn")?.addEventListener("click",submitRoomCreateSettings);
    document.getElementById("roomCreateCancelBtn")?.addEventListener("click",()=>socialClose("roomCreateModal"));document.getElementById("roomCreateCancelX")?.addEventListener("click",()=>socialClose("roomCreateModal"));
    elements.openPublicRoomsBtn?.addEventListener("click",()=>{const browser=document.getElementById("publicRoomBrowser");browser.hidden=!browser.hidden;if(!browser.hidden){renderRoomTagControls();fetchPublicRooms().catch(()=>{});}});
    document.getElementById("publicRoomsRefreshBtn")?.addEventListener("click",()=>fetchPublicRooms().catch(()=>{}));
    document.getElementById("publicRoomRuleFilter")?.addEventListener("change",event=>{state.publicRoomFilters.regulationId=event.target.value;renderPublicRooms();});
    document.getElementById("publicRoomTagFilterBtn")?.addEventListener("click",()=>{const box=document.getElementById("publicRoomTagFilter");box.hidden=!box.hidden;});
    document.getElementById("publicRoomTagFilter")?.addEventListener("change",()=>{state.publicRoomFilters.tags=selectedCheckboxValues("publicRoomTagFilter");renderPublicRooms();});
    document.getElementById("quickMatchBtn")?.addEventListener("click",()=>quickMatchPublicRoom().catch(()=>{}));
    document.getElementById("publicRoomDetailCloseBtn")?.addEventListener("click",()=>socialClose("publicRoomDetailModal"));document.getElementById("publicRoomDetailJoinBtn")?.addEventListener("click",()=>state.selectedPublicRoom&&claimPublicRoom(state.selectedPublicRoom.roomId));
    elements.joinRoomBtn.addEventListener("click", () => {
      elements.friendLobbyMessage.textContent="部屋に参加中…";
      joinFriendRoom(elements.roomIdInput.value).catch(error => {
        console.error("[FriendFirestore] joinRoom failed",error);
        elements.friendLobbyMessage.textContent = friendFirestoreErrorMessage(error,"部屋へ入室できませんでした。");
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
    elements.friendStartBattleBtn.addEventListener("click", () => startFriendCommonBattle().catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `試合開始エラー：${error.message || error}`;
    }));
    socialEl("loginOpenBtn")?.addEventListener("click",()=>socialOpen("authModal"));
    socialEl("authCloseBtn")?.addEventListener("click",()=>socialClose("authModal"));
    socialEl("accountOpenBtn")?.addEventListener("click",()=>socialOpen("accountModal"));
    socialEl("accountCloseBtn")?.addEventListener("click",()=>socialClose("accountModal"));
    socialEl("playerCardEditBtn")?.addEventListener("click",async()=>{try{await prepareProfileChange(openPlayerCardEditor);}catch(error){showProfileActionError(error);}});
    socialEl("playerCardTitleSelect")?.addEventListener("change",event=>{if(state.playerCardDraft){state.playerCardDraft.titleId=event.target.value;renderPlayerCardDraft();}});
    socialEl("playerCardSaveBtn")?.addEventListener("click",async()=>{try{await savePlayerCard();}catch(error){socialMessage("playerCardEditorMessage",error.message);}});
    socialEl("playerCardCancelBtn")?.addEventListener("click",closePlayerCardEditor);socialEl("playerCardEditorCloseBtn")?.addEventListener("click",closePlayerCardEditor);
    socialEl("playerNameChangeBtn")?.addEventListener("click",async()=>{try{await prepareProfileChange(async()=>{await ensureProfileChangeAllowed();openPlayerNameEditor();});}catch(error){showProfileActionError(error);}});
    socialEl("playerNameSaveBtn")?.addEventListener("click",async()=>{try{await changePlayerName();}catch(error){socialMessage("playerNameMessage",error.message);}});
    socialEl("playerNameCancelBtn")?.addEventListener("click",()=>closeAccountChildModal("playerNameModal"));socialEl("playerNameCloseBtn")?.addEventListener("click",()=>closeAccountChildModal("playerNameModal"));
    socialEl("giftCodeOpenBtn")?.addEventListener("click",()=>{socialEl("giftCodeInput").value="";socialMessage("giftCodeMessage","");openAccountChildModal("giftCodeModal");queueMicrotask(()=>socialEl("giftCodeInput")?.focus());});
    socialEl("giftCodeClaimBtn")?.addEventListener("click",async()=>{try{await claimGiftCode();}catch(error){socialMessage("giftCodeMessage",error.message);}});
    socialEl("giftCodeCancelBtn")?.addEventListener("click",()=>closeAccountChildModal("giftCodeModal"));socialEl("giftCodeCloseBtn")?.addEventListener("click",()=>closeAccountChildModal("giftCodeModal"));
    socialEl("socialFriendsOpenBtn")?.addEventListener("click",()=>socialOpen("socialFriendsPanel"));
    socialEl("socialFriendsCloseBtn")?.addEventListener("click",()=>socialClose("socialFriendsPanel"));
    socialEl("publicProfileCloseBtn")?.addEventListener("click",()=>socialClose("publicProfileModal"));
    document.querySelectorAll("[data-social-tab]").forEach(button=>button.addEventListener("click",()=>{
      document.querySelectorAll("[data-social-tab]").forEach(item=>item.classList.toggle("active",item===button));
      document.querySelectorAll("[data-social-pane]").forEach(pane=>pane.hidden=pane.dataset.socialPane!==button.dataset.socialTab);
    }));
    function switchAuthPane(register){socialEl("authLoginPane").hidden=register;socialEl("authRegisterPane").hidden=!register;socialEl("authLoginTab").classList.toggle("active",!register);socialEl("authRegisterTab").classList.toggle("active",register);socialMessage("authMessage","");}
    socialEl("authLoginTab")?.addEventListener("click",()=>switchAuthPane(false));socialEl("authRegisterTab")?.addEventListener("click",()=>switchAuthPane(true));
    socialEl("googleLoginBtn")?.addEventListener("click",()=>loginWithGoogle(false).catch(error=>socialMessage("authMessage",firebaseAuthErrorMessage(error))));
    socialEl("googleRegisterBtn")?.addEventListener("click",()=>loginWithGoogle(true).catch(error=>socialMessage("authMessage",firebaseAuthErrorMessage(error))));
    socialEl("emailLoginBtn")?.addEventListener("click",async()=>{try{const fb=window.WaribashiFirebase;await applyAuthPersistence(selectedLoginPersistence(false));await fb.signInWithEmailAndPassword(fb.auth,socialEl("loginEmailInput").value.trim(),socialEl("loginPasswordInput").value);socialClose("authModal");await loadSocialProfile();}catch(error){socialMessage("authMessage",firebaseAuthErrorMessage(error));}});
    socialEl("emailRegisterBtn")?.addEventListener("click",()=>registerWithEmail().catch(error=>socialMessage("authMessage",firebaseAuthErrorMessage(error))));
    socialEl("profileSetupSaveBtn")?.addEventListener("click",async()=>{try{await createSocialProfile(socialEl("profileSetupNameInput").value);socialClose("profileSetupModal");renderSocialAccountUi();subscribeSocialData();}catch(error){socialMessage("profileSetupMessage",firebaseAuthErrorMessage(error));}});
    socialEl("logoutBtn")?.addEventListener("click",async()=>{try{const fb=window.WaribashiFirebase;cleanupSocialListeners();state.socialProfile=null;socialClose("accountModal");await fb.signOut(fb.auth);await fb.signInAnonymously(fb.auth);renderSocialAccountUi();}catch(error){socialMessage("accountMessage",firebaseAuthErrorMessage(error));}});
    socialEl("accountRememberCheckbox")?.addEventListener("change",event=>applyAuthPersistence(event.target.checked,{announce:true}).catch(error=>{event.target.checked=!event.target.checked;socialMessage("accountMessage",firebaseAuthErrorMessage(error));}));
    socialEl("authRememberCheckbox")?.addEventListener("change",event=>{const other=socialEl("registerRememberCheckbox");if(other)other.checked=event.target.checked;});
    socialEl("registerRememberCheckbox")?.addEventListener("change",event=>{const other=socialEl("authRememberCheckbox");if(other)other.checked=event.target.checked;});
    socialEl("blockedListBtn")?.addEventListener("click",()=>renderBlockedPlayers().catch(error=>socialMessage("accountMessage",firebaseAuthErrorMessage(error))));
    socialEl("blockedList")?.addEventListener("click",async event=>{const uid=event.target.dataset.unblock;if(!uid)return;try{const fb=firebaseApi();await fb.deleteDoc(fb.doc(fb.db,"users",state.socialProfile.uid,"blocked",uid));await renderBlockedPlayers();}catch(error){socialMessage("accountMessage",firebaseAuthErrorMessage(error));}});
    socialEl("playerSearchBtn")?.addEventListener("click",async()=>{try{const profile=await searchPlayerByPublicId(socialEl("playerSearchInput").value);socialEl("playerSearchResult").innerHTML=profile?socialListRow(profile.publicId,`<button data-search-profile="${profile.uid}">詳細</button><button data-search-add="${profile.uid}">申請する</button>`):"<p class=\"social-empty\">該当するプレイヤーはいません。</p>";state.socialCurrentProfile=profile;socialMessage("socialMessage","");}catch(error){socialMessage("socialMessage",firebaseAuthErrorMessage(error));}});
    socialEl("socialFriendsPanel")?.addEventListener("click",async event=>{let operation="request";try{const profileUid=event.target.dataset.socialProfile;if(profileUid){const friend=state.socialFriends.find(item=>item.uid===profileUid);if(friend)await openSocialProfile(friend);return;}const searchUid=event.target.dataset.searchProfile;if(searchUid&&state.socialCurrentProfile?.uid===searchUid){await openSocialProfile(state.socialCurrentProfile);return;}const addUid=event.target.dataset.searchAdd;if(addUid){await sendFriendRequest(state.socialCurrentProfile);socialMessage("socialMessage","フレンド申請を送りました。");event.target.disabled=true;return;}const acceptId=event.target.dataset.requestAccept;if(acceptId){operation="accept";const request=state.socialIncomingRequests.find(item=>item.id===acceptId);if(request)await acceptFriendRequest(request);return;}const rejectId=event.target.dataset.requestReject;if(rejectId){const request=state.socialIncomingRequests.find(item=>item.id===rejectId);if(request)await rejectFriendRequest(request);}}catch(error){socialMessage("socialMessage",socialOperationError(error,operation));}});
    socialEl("battleInviteBtn")?.addEventListener("click",()=>{state.pendingFriendInviteTarget=state.socialCurrentProfile;socialClose("publicProfileModal");socialOpen("friendInviteRuleModal");});
    socialEl("friendInviteCancelBtn")?.addEventListener("click",()=>{state.pendingFriendInviteTarget=null;socialClose("friendInviteRuleModal");});
    socialEl("friendInviteSendBtn")?.addEventListener("click",async event=>{if(event.currentTarget.disabled||!state.pendingFriendInviteTarget)return;event.currentTarget.disabled=true;try{await sendBattleInvite(state.pendingFriendInviteTarget,socialEl("friendInviteRegulationSelect").value);socialClose("friendInviteRuleModal");socialMessage("socialMessage","対戦招待を送りました。60秒間有効です。");state.pendingFriendInviteTarget=null;}catch(error){socialMessage("friendInviteRuleMessage",socialOperationError(error,"invite"));}finally{event.currentTarget.disabled=false;}});
    socialEl("sendFriendRequestBtn")?.addEventListener("click",()=>sendFriendRequest(state.socialCurrentProfile).then(()=>socialMessage("publicProfileMessage","フレンド申請を送りました。")).catch(error=>socialMessage("publicProfileMessage",socialOperationError(error,"request"))));
    socialEl("removeFriendBtn")?.addEventListener("click",async()=>{if(!await requestSocialConfirmation("フレンド解除",`${state.socialCurrentProfile.publicId} をフレンドから解除しますか？`))return;removeSocialFriend(state.socialCurrentProfile).then(()=>socialClose("publicProfileModal")).catch(error=>socialMessage("publicProfileMessage",firebaseAuthErrorMessage(error)));});
    socialEl("blockPlayerBtn")?.addEventListener("click",async()=>{if(!await requestSocialConfirmation("プレイヤーをブロック",`${state.socialCurrentProfile.publicId} をブロックしますか？`))return;blockSocialPlayer(state.socialCurrentProfile).then(()=>socialClose("publicProfileModal")).catch(error=>socialMessage("publicProfileMessage",firebaseAuthErrorMessage(error)));});
    socialEl("acceptBattleInviteBtn")?.addEventListener("click",()=>acceptBattleInvite().catch(error=>{hideBattleInviteToast();socialMessage("socialMessage",socialOperationError(error,"invite"));}));
    socialEl("declineBattleInviteBtn")?.addEventListener("click",()=>declineBattleInvite().catch(error=>console.error(error)));
    const handleSocialAuth=()=>{updateFriendAuthUi();loadSocialProfile().catch(error=>console.error("[Social] profile",error));};
    window.addEventListener("waribashi-firebase-ready",handleSocialAuth);
    window.addEventListener("waribashi-auth-ready",handleSocialAuth);
    window.addEventListener("waribashi-auth-changed",handleSocialAuth);
    window.addEventListener("waribashi-firebase-error",updateFriendAuthUi);
    window.addEventListener("waribashi-auth-signed-out",updateFriendAuthUi);
    updateFriendAuthUi();
    renderSocialAccountUi();
    if(window.WaribashiFirebase?.authUser)loadSocialProfile().catch(error=>console.error("[Social] initial profile",error));
    elements.copyRoomUrlBtn.addEventListener("click", async () => {
      if (!state.friendRoomUrl) return;
      try {
        await navigator.clipboard.writeText(state.friendRoomUrl);
        elements.friendLobbyMessage.textContent = "部屋URLをコピーしました。友達に送ってください。";
      } catch (_) {
        elements.friendLobbyMessage.textContent = "コピーできない場合は、表示されたURLを長押し/選択してコピーしてください。";
      }
    });
    elements.menuDeckBtn.addEventListener("click", () => {state.deckRuleContext=null;showScreen("deck");});
    elements.menuSettingsBtn.addEventListener("click", () => showScreen("settings"));
    elements.menuNewsBtn?.addEventListener("click", () => openNews("all"));
    elements.newsCloseBtn?.addEventListener("click", closeNews);
    elements.newsModal?.addEventListener("click", event => {
      if (event.target === elements.newsModal) closeNews();
    });
    elements.newsFilterRow?.querySelectorAll(".news-filter").forEach(button => {
      button.addEventListener("click", () => {
        const filter = button.dataset.newsFilter || "all";
        elements.newsFilterRow.querySelectorAll(".news-filter").forEach(item => {
          item.classList.toggle("active", item === button);
        });
        renderNewsList(filter);
      });
    });
    elements.majorUpdateCloseBtn?.addEventListener("click", closeMajorUpdate);
    elements.majorUpdateDetailBtn?.addEventListener("click", () => {
      closeMajorUpdate();
      openNews("all");
    });
    elements.majorUpdateModal?.addEventListener("click", event => {
      if (event.target === elements.majorUpdateModal) closeMajorUpdate();
    });
    elements.difficultyBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.settingsBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.compactCardDescriptionsToggle?.addEventListener("change", event => {
      displaySettings.compactCardDescriptions = event.target.checked;
      saveDisplaySettings();
      render();
    });
    elements.deckCompactModeToggle?.addEventListener("change", event => {
      displaySettings.deckCompactMode = event.target.checked;
      saveDisplaySettings();
      renderDeckBuilder();
    });
    elements.deckBackMenuBtn.addEventListener("click", () => {
      if (state.friendDeckEditReturnToLobby && state.friendRoomId) {
        state.friendDeckEditReturnToLobby = false;
        showScreen("friendLobby");
        updateFriendLobbyView(state.friendRoomData);
        elements.friendLobbyMessage.textContent = "デッキ編集を終了しました。準備完了を押すと新しいデッキを提出します。";
        return;
      }
      state.deckRuleContext=null;
      showScreen("menu");
    });
    elements.battleBackMenuBtn.addEventListener("click", () => {if(state.battleMode==="friend")return;showScreen("menu");});
    elements.battleRestartBtn.addEventListener("click", () => startBattleWithDifficulty(state.cpuDifficulty));

    document.querySelectorAll("[data-difficulty-start]").forEach(btn => {
      btn.addEventListener("click", () => startBattleWithDifficulty(btn.dataset.difficultyStart));
    });

    elements.andanteMinusBtn.addEventListener("click", async () => {
      await applyAndanteDelta(-1);
    });

    elements.andantePlusBtn.addEventListener("click", async () => {
      await applyAndanteDelta(1);
    });

    elements.andanteCancelBtn.addEventListener("click", () => {
      state.pendingAndanteHand = null;
      state.mode = "attack";
      elements.andanteBox.classList.remove("active");
      setMessage("アンダンテの対象選択を解除しました。カードの使用自体は消費されています。");
      render();
    });

    elements.attackBtn.addEventListener("click", () => {
      if(isFriendInteractionBlocking())return;
      if (state.temp.human.setupMode) return;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      setMessage("自分の攻撃する手を選んでください。");
      render();
    });

    elements.splitBtn.addEventListener("click", () => {
      if(isFriendInteractionBlocking())return;
      if (isTutorialBattle()) {
        if (tutorial.expected !== "split") {
          setMessage("今は指定された操作を行ってください。");
          return;
        }
        setTimeout(() => { tutorial.step++; renderRealTutorialStep(); }, 120);
      }
      if (state.temp.human.setupMode) return;
      if (
        (state.temp.human?.attackLimit || 1) > 1 &&
        (state.temp.human?.attacksUsed || 0) > 0 &&
        (state.temp.human?.attacksUsed || 0) < (state.temp.human?.attackLimit || 1)
      ) {
        const source = state.temp.human?.multiAttackSource;
        setMessage(source ? `「${source}」の追加攻撃中は攻撃だけを選べます。` : "追加攻撃中は攻撃だけを選べます。");
        return;
      }
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
      if(state.battleMode==="friend")return;
      if (state.turn !== "human" || state.gameOver || state.animating || state.temp.human.setupMode) return;
      drawCard("human");
      setMessage("手札を1枚引きました。これはテスト用ボタンです。");
      render();
    });

    elements.cancelBtn.addEventListener("click", async () => {
      if(isFriendInteractionBlocking())return;
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
      elements.andanteBox?.classList.remove("active");
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
      elements.andanteBox?.classList.remove("active");
      setMessage("選択を解除しました。");
      render();
    });

    elements.resetBtn.addEventListener("click", () => {
      if(state.battleMode==="friend")return;
      resetGame();
      setMessage("試合をリセットしました。");
    });

    elements.splitLeft.addEventListener("change", () => syncSplitSelects("left"));
    elements.splitRight.addEventListener("change", () => syncSplitSelects("right"));
    elements.allocationLeft.addEventListener("change", () => syncNumberAllocation("left"));
    elements.allocationRight.addEventListener("change", () => syncNumberAllocation("right"));
    elements.allocationConfirmBtn.addEventListener("click", finishNumberAllocation);
    elements.handCardSelectionConfirmBtn.addEventListener("click", finishHandCardSelection);

    elements.confirmSplitBtn.addEventListener("click", async () => {
      if (tutorial.usingRealBattle && state.battleMode === "tutorial" && tutorial.expected === "confirmSplit") {
        setTimeout(() => { tutorial.step++; renderRealTutorialStep(); }, 700);
      }
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
        if (h.count !== DECK_MAX_COUNT || c.count !== DECK_MAX_COUNT) setMessage(`あなた用・CPU用の両方をちょうど${DECK_MAX_COUNT}枚にしてください。`);
        else setMessage("あなた用・CPU用のどちらかがコスト上限を超えています。");
        return;
      }
      setMessage("デッキは使用可能です。対戦を始める場合は、メニューに戻ってスタートを選んでください。");
      renderDeckBuilder();
    });

    elements.defaultDeckBtn.addEventListener("click", () => {
      state.deckCounts[state.editingDeckOwner] = { ...DEFAULT_DECK_COUNTS };
      persistCurrentDecks();
      renderDeckBuilder();
      setMessage(`${state.editingDeckOwner === "human" ? "あなた用" : "CPU用"}デッキを初期状態に戻しました。`);
    });

    elements.clearDeckBtn.addEventListener("click", async () => {
      const label = state.editingDeckOwner === "human" ? "あなた用" : "CPU用";
      if (!await showGameConfirmation({title:"デッキを空にする",message:`${label}デッキを空にしますか？ 保存スロットの内容は消えません。`,confirmLabel:"空にする",cancelLabel:"変更しない"})) return;
      state.deckCounts[state.editingDeckOwner] = cloneValidDeckCounts({});
      persistCurrentDecks();
      renderDeckBuilder();
      setMessage(`${label}デッキを空にしました。`);
    });


    elements.deckSortSelect?.addEventListener("change", event => {
      state.deckSortMode = event.target.value || "implementation";
      renderDeckBuilder();
    });
    elements.deckSearchInput?.addEventListener("input", event => {
      state.deckSearch = event.target.value || "";
      renderDeckBuilder();
      elements.deckSearchInput?.focus();
    });
    elements.deckTypeFilter?.addEventListener("change", event => { state.deckFilters.type = event.target.value; renderDeckBuilder(); });
    elements.deckCostFilter?.addEventListener("change", event => { state.deckFilters.cost = event.target.value; renderDeckBuilder(); });
    elements.deckThemeFilter?.addEventListener("change", event => { state.deckFilters.theme = event.target.value; renderDeckBuilder(); });
    elements.deckOnlyToggle?.addEventListener("change", event => {
      state.deckFilters.deckOnly = event.target.checked;
      if (event.target.checked) state.deckFilters.unselectedOnly = false;
      renderDeckBuilder();
    });
    elements.deckUnselectedToggle?.addEventListener("change", event => {
      state.deckFilters.unselectedOnly = event.target.checked;
      if (event.target.checked) state.deckFilters.deckOnly = false;
      renderDeckBuilder();
    });
    elements.deckFavoriteOnlyToggle?.addEventListener("change", event => { state.deckFilters.favoriteOnly = event.target.checked; renderDeckBuilder(); });
    elements.deckSearchClearBtn?.addEventListener("click", () => {
      state.deckSearch = "";
      state.deckFilters = { type: "", cost: "", theme: "", deckOnly: false, unselectedOnly: false, favoriteOnly: false };
      renderDeckBuilder();
      elements.deckSearchInput?.focus();
    });
    elements.deckDetailsBtn?.addEventListener("click", openCurrentDeckDetails);

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
    elements.deckSlotSelect.addEventListener("change", updateDeckSlotUi);
    elements.deckInfoCloseBtn.addEventListener("click", closeDeckInfo);
    elements.deckInfoModal.addEventListener("click", (event) => {
      if (event.target === elements.deckInfoModal) closeDeckInfo();
    });
    elements.copyDeckBtn.addEventListener("click", () => {
      const from = state.editingDeckOwner;
      const to = from === "human" ? "cpu" : "human";
      state.deckCounts[to] = { ...currentDeckCounts(from) };
      persistCurrentDecks();
      renderDeckBuilder();
      setMessage(`${from === "human" ? "あなた用" : "CPU用"}デッキを${to === "human" ? "あなた用" : "CPU用"}にコピーしました。`);
    });

    elements.exportCurrentDeckBtn.addEventListener("click", exportCurrentDeckCode);
    elements.exportBothDecksBtn.addEventListener("click", exportBothDecksCode);
    elements.copyDeckCodeBtn.addEventListener("click", copyDeckCode);
    elements.importDeckCodeBtn.addEventListener("click", importDeckCode);

    elements.openHelpBtn.addEventListener("click", () => openHelp("basic"));
    elements.openCardsHelpBtn.addEventListener("click", () => openHelp("cards"));
    elements.attachmentDetailCloseBtn?.addEventListener("click", closeAttachmentDetail);
    elements.attachmentDetailModal?.addEventListener("click", (event) => {
      if (event.target === elements.attachmentDetailModal) closeAttachmentDetail();
    });

    elements.helpCloseBtn.addEventListener("click", closeHelp);
    elements.helpModal.addEventListener("click", (event) => {
      if (event.target === elements.helpModal) closeHelp();
    });
    elements.helpTabs.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => renderHelp(btn.dataset.helpTab));
    });

    // 起動時に保存済みデッキを自動読込する。ゲスト側も準備完了時に実際の自分用デッキを提出できる。
    loadDecksSilentlyOnStartup();
    ensureStarterDeckInHumanSlotOne();
    renderDeckBuilder();
    loadDisplaySettings();
    if (elements.compactCardDescriptionsToggle) {
      elements.compactCardDescriptionsToggle.checked = displaySettings.compactCardDescriptions;
    }
    if (elements.deckCompactModeToggle) elements.deckCompactModeToggle.checked = displaySettings.deckCompactMode;
    initializeDeckFilterOptions();
    showScreen("menu");
    updateNewsUnreadBadge();
    renderFeaturedNews();
    renderNewsList("all");
    renderTutorialChapterList();
    if (shouldShowTutorialWelcome()) {
      setTimeout(() => showTutorialWelcome(), 180);
    } else if (shouldShowMajorUpdate()) {
      setTimeout(() => openMajorUpdate(), 320);
    }
    loadRoomFromUrl();
