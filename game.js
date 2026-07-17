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
        type: "補助",
        text: "手札を1枚捨て、自分の0の手を1にする。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] === 0) && state.hands[player].length > 1,
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
          const [discarded] = state.hands[player].splice(discardIndex, 1);
          state.discard[player].push(discarded);
          await handleCardDiscardEffect(player, discarded);
          state[player][hand] = 1;
          addLog(`${handNames[player]}は「補修」で「${CARD_LIBRARY[discarded].name}」を捨て、${handNames[hand]}を0→1に戻した。`);
        }
      },

      charge: {
        name: "充電", cost: 1, type: "使用不可 / 生成カード / 充電",
        text: "Lv.1～10。コストはレベルと同じ。充電効果以外では捨てたり移動できない。充電を得る時はレベルが上がり、Lv.10ではそれ以上得られない。",
        token: true, chargeResource: true, canPlay: () => false
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
        text: "充電5を消費。使用前の充電4につき、次の攻撃で与える本数+1。使用前がLv.10なら、その攻撃で超過計算前の合計が5以上になった時、あまりを計算せず0にする。充電不足なら不発。",
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
        text: "自分の充電5につき受ける本数-1。充電Lv.10なら、この手が与える本数+1。",
        canPlay: (player) => canPlaceAttachment(player,player)
      },
      synapseMotion: {
        name: "シナプス運動", cost: 2, type: "補助 / 充電", chargeCard: true,
        text: "次の攻撃で与える本数+1。充電を4得る。", canPlay: () => true,
        effect: (player) => { state.temp[player].synapseBonus=(state.temp[player].synapseBonus||0)+1; gainCharge(player,4,"シナプス運動"); }
      },
      lightSpeedCircuit: {
        name: "光速回路", cost: 3, type: "補助 / 充電", chargeCard: true,
        text: "1試合に1度だけ発動できる。使用時の充電がLv.10未満なら、カードは捨て札になるが効果は不発。Lv.10なら、このターン充電カードを何枚でも使用でき、充電カードの終端を無視する。終了時に充電0、次の自分ターンは行動不能。",
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
        text: "この手の通常攻撃によって相手の手を0にした時、その攻撃で与えた本数の2倍だけ充電を得る。",
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
        text: "この手で相手を通常攻撃した時、その攻撃で与えた本数と同じ値だけ充電を得る。",
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
        text: "1ターンに1度。充電5未満なら不発。充電5以上10未満なら充電5を消費し、自分の手を1つ0にして発動。充電10なら充電5を消費し、手を失わず発動。このターンの通常攻撃で与える本数+1。通常攻撃を2回行える。1回目の後は攻撃だけを選べる。",
        canPlay: (player) => !state.temp[player].dimensionalSlashUsed,
        effect: (player) => {
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
              state.mode = "dimensionalSlashSacrifice";
              setMessage("「空間切断」：0にする自分の手を選んでください。");
              render();
              return;
            }
            const choices = ["L", "R"].filter(hand => state[player][hand] > 0);
            const chosen = choices.sort((a, b) => state[player][a] - state[player][b])[0] || "L";
            resolveDimensionalSlash(player, chosen);
            return;
          }

          resolveDimensionalSlash(player, null);
        }
      },

      brawl: {
        name: "乱闘",
        cost: 2,
        type: "補助",
        text: "自分の手札から「乱闘」「指令」「ロジックアトリエ」を除く、効果を持つカードをランダムに1枚選ぶ。使用条件とコストを無視して、その効果だけを発動する。選ばれたカードは消費されない。",
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
          await activateCopiedCardEffect(player, picked.cardId, "乱闘");
        }
      },
      advanceNotice: {
        name: "予告状",
        cost: 2,
        type: "補助",
        text: "現在使用条件を満たしているカードを手札から1枚選び、相手に公開して捨て札にする。次の自分のターン開始時、そのカードの使用条件とコストを無視して効果だけを発動する。「予告状」「指令」「ロジックアトリエ」は選べない。",
        canPlay: (player) => getAdvanceNoticeCandidates(player).length > 0,
        effect: async (player) => {
          if (player === "human") {
            state.mode = "advanceNoticeChoose";
            setMessage("「予告状」：次の自分のターンに発動するカードを選んでください。選んだカードは公開して捨て札になります。");
            return;
          }
          const candidates = getAdvanceNoticeCandidates(player);
          if (!candidates.length) {
            addLog(`${handNames[player]}の「予告状」は、宣言できるカードがなく不発になった。`);
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
        text: "この加護が付いた手で同じ手を連続して通常攻撃するとLvが上がる。別の手を攻撃するとLv1になる。最大Lv5。Lvに応じて与える本数増加・受ける本数軽減を得る。別の自分の手による攻撃では変化しない。",
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
      elements.andanteBox?.classList.remove("active");
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
        text: "自分か相手の山札を選び、その山札の一番上のカードを確認する。",
        canPlay: () => true,
        effect: async (player) => {
          const opponent = player === "human" ? "cpu" : "human";
          let target = opponent;

          if (player === "human") {
            const inspectOwn = window.confirm(
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
        text: "このカードは使用できない。引いた時に右手か左手を指定する。ターン終了時、指定された手で攻撃していれば達成：1枚引く。未達成：手札をランダムに1枚捨てる。凶弾による攻撃も含む。",
        directive: true,
        canPlay: () => false
      },
      directiveTarget: {
        name: "指令：対象指定",
        cost: 2,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。引いた時に攻撃する手と攻撃対象の手を指定する。ターン終了時、指定された組み合わせで攻撃していれば達成：2枚引く。未達成：指定された自分の手に1本加える。凶弾による攻撃も含む。",
        directive: true,
        canPlay: () => false
      },
      directiveSilence: {
        name: "指令：沈黙",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。ターン終了時、このターンに手札からカードを使用していなければ達成：2枚引く。未達成：次の自分のターン、通常の開始時ドローを行わない。",
        directive: true,
        canPlay: () => false
      },
      directiveReform: {
        name: "指令：再編成",
        cost: 1,
        type: "指令 / 使用不可",
        text: "このカードは使用できない。ターン終了時、このターンに「分ける」を行っていれば達成：次の自分のターン、開始時ドロー+1。未達成：本数が多い方の手に1本加える。同数ならランダム。",
        directive: true,
        canPlay: () => false
      },
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
        text: "前の自分のターンに達成した指令の数だけ、この手を使った通常攻撃で相手に加える本数を増やす。",
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
          if (player === "human") {
            state.mode = "cityWillChoose";
            setMessage("「都市の意志」：相手に渡す指令を選んでください。");
            return;
          }
          const choices = state.hands[player]
            .map((id, index) => ({ id, index }))
            .filter(x => isDirectiveCard(x.id));
          if (!choices.length) return;
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
      elements.andanteBox?.classList.remove("active");
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
        text: "このターン、自分の共鳴攻撃の攻撃力+2。",
        canPlay: () => true,
        effect: (player) => {
          state.temp[player].crescendo = true;
          addLog(`${handNames[player]}は「クレッシェンド」を使った。このターン、共鳴攻撃の攻撃力+2。`);
        }
      },
      dance: {
        name: "乱舞",
        cost: 2,
        type: "補助",
        text: "このターン、次の自分の攻撃ではダメージを与えない。代わりに、攻撃対象の手の本数を攻撃した手と同じ本数にする。",
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
        text: "自分の手に表向きで置く。この手の攻撃が共鳴する場合、その攻撃の攻撃力+1。さらに、この手で共鳴を発生させたときカードを1枚引く。",
        blessing: true,
        canPlay: (player) => canPlaceAttachment(player, player)
      },
      andante: {
        name: "アンダンテ",
        cost: 1,
        type: "補助",
        text: "自分の0でない手を1つ選ぶ。その手の本数を1増やすか1減らす。この効果で0にはできない。",
        canPlay: (player) => ["L", "R"].some(h => state[player][h] > 0),
        effect: (player) => {
          if (player === "human") {
            state.mode = "andante";
            state.pendingAndanteHand = null;
      state.pendingDirectiveDraw = { human: 0, cpu: 0 };
      state.pendingDirectiveNoDraw = { human: 0, cpu: 0 };
      state.pendingDirectiveBonusDraw = { human: 0, cpu: 0 };
      state.lastDirectiveClearCount = { human: 0, cpu: 0 };
      state.activeDirectiveBlessing = { human: 0, cpu: 0 };
      state.pendingChargeStun = { human: false, cpu: false };
      state.pendingChargeStunSource = { human: "", cpu: "" };
      state.cheapBatteryDecay = { human: 0, cpu: 0 };
      state.energyBarrier = { human: 0, cpu: 0 };
      state.pendingChargeTarget = null;
      state.lightSpeedCircuitUsed = { human: false, cpu: false };
      state.cheapBatteryDecay = { human: 0, cpu: 0 };
      state.energyBarrier = { human: 0, cpu: 0 };
      state.pendingChargeTarget = null;
      state.pendingWillTorrent = { human: 0, cpu: 0 };
      state.pendingAdvanceNotice = { human: [], cpu: [] };
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
        text: "【攻撃判定後・自動】この手が攻撃で0になったとき発動する。攻撃した相手は手札をランダムに1枚捨てる。手札がない場合も発動するが、捨て札効果は発生しない。",
        trap: true,
        manual: false,
        triggerTiming: "after",
        canTrigger: ({ placedHand, targetHand, resolvedFinal }) => {
          return placedHand === targetHand && resolvedFinal === 0;
        },
        trigger: async ({ attacker }) => {
          const discarded = discardOneCard(attacker);
          if (discarded) {
            addLog(`罠「置き土産」により、${handNames[attacker]}は「${CARD_LIBRARY[discarded]?.name || discarded}」を捨てた。`);
            await handleCardDiscardEffect(attacker, discarded);
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
        cost: 2,
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
      bulletproofVest: {
        name: "防弾チョッキ",
        cost: 2,
        type: "加護",
        text: "自分の手に表向きで置く。この手は「狙撃」「乱射」の効果によって本数を加えられない。「ロジックアトリエ」の効果は防げない。手が0になったら捨て札に置く。",
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
        text: "相手の手に表向きで置く。この手は7以上になったら、余り計算をせず0になる。",
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

        const DECK_MIN_COUNT = 20;
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
      deckSortMode: "implementation",
      deckNameSearch: "",
      deckKeywordSearch: "",
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
      pendingAndanteHand: null,
      pendingDirectiveDraw: { human: 0, cpu: 0 },
      pendingDirectiveNoDraw: { human: 0, cpu: 0 },
      pendingDirectiveBonusDraw: { human: 0, cpu: 0 },
      lastDirectiveClearCount: { human: 0, cpu: 0 },
      activeDirectiveBlessing: { human: 0, cpu: 0 },
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
      lastShownResultKey: null,
      friendResultPublishing: false,
      log: [],
      turnNumber: 0,
      currentScreen: "menu",
      battleMode: "cpu",
      tutorialBattleActive: false,
      tutorialScriptedCpuAction: false,
      friendRoomId: null,
      friendRoomUrl: null,
      friendRole: null,
      friendReady: false,
      friendUnsubscribe: null,
      friendRoomData: null,
      friendMatchId: null,
      friendMatchStarted: false,
      friendSyncRevision: 0,
      friendLastAppliedRevision: 0,
      friendApplyingRemoteState: false,
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
      friendDeckEditReturnToLobby: false
    };

    const DISPLAY_SETTINGS_STORAGE_KEY = "waribashi_card_display_settings_v1";
    const NEWS_STORAGE_KEY = "waribashi_card_last_seen_news";
    const MAJOR_UPDATE_STORAGE_KEY = "waribashi_card_major_update_v85";
    const LATEST_NEWS_ID = "v96-tutorial-explanation-ok-trap-fix";

    const UPDATE_NEWS = [
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
        system: "SYSTEM"
      }[tag] || String(tag || "").toUpperCase();
    }

    const displaySettings = {
      compactCardDescriptions: false
    };

    function loadDisplaySettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY) || "{}");
        displaySettings.compactCardDescriptions = saved.compactCardDescriptions === true;
      } catch {
        displaySettings.compactCardDescriptions = false;
      }
    }

    function saveDisplaySettings() {
      try {
        localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(displaySettings));
      } catch {}
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
      strongHit: { name: "強打", type: "攻撃補助", text: "このターン、次の攻撃で与える本数を＋1する。" },
      lightHit: { name: "軽打", type: "攻撃補助", text: "このターン、次の攻撃で与える本数を1減らす。" },
      pass: { name: "パス", type: "終端", text: "このカードを使うと、ただちにターンを終了する。" },
      miss: { name: "空振り", type: "罠・手動", text: "攻撃された時、発動するか選び、その攻撃を無効にする。" },
      thorns: { name: "茨", type: "罠・自動", text: "攻撃された時に自動発動し、攻撃した相手の手に＋1する。" },
      powerBlessing: { name: "力の加護", type: "加護", text: "この手で与える本数を＋1する。発動後も場に残る。" },
      sluggishCurse: { name: "鈍重の呪縛", type: "呪縛", text: "この手で攻撃する時、与える本数を1減らす。相手の手に付ける。" }
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
      friendStartBattleBtn: document.getElementById("friendStartBattleBtn"),
      friendLobbyBackBtn: document.getElementById("friendLobbyBackBtn"),
      difficultyBackBtn: document.getElementById("difficultyBackBtn"),
      settingsBackBtn: document.getElementById("settingsBackBtn"),
      compactCardDescriptionsToggle: document.getElementById("compactCardDescriptionsToggle"),
      deckBackMenuBtn: document.getElementById("deckBackMenuBtn"),
      battleBackMenuBtn: document.getElementById("battleBackMenuBtn"),
      battleRestartBtn: document.getElementById("battleRestartBtn"),
      battleResultReopenBtn: document.getElementById("battleResultReopenBtn"),
      humanState: document.getElementById("humanState"),
      cpuState: document.getElementById("cpuState"),
      splitBox: document.getElementById("splitBox"),
      splitLeft: document.getElementById("splitLeft"),
      splitRight: document.getElementById("splitRight"),
      splitHint: document.getElementById("splitHint"),
      andanteBox: document.getElementById("andanteBox"),
      andanteLabel: document.getElementById("andanteLabel"),
      andanteMinusBtn: document.getElementById("andanteMinusBtn"),
      andantePlusBtn: document.getElementById("andantePlusBtn"),
      andanteCancelBtn: document.getElementById("andanteCancelBtn"),
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
      deckNameSearchInput: document.getElementById("deckNameSearchInput"),
      deckKeywordSearchInput: document.getElementById("deckKeywordSearchInput"),
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
          kind === "card-detail" ? " card-detail" : "") +
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
          kind === "action" ? " action" : "");
      elements.popupUser.textContent =
        kind === "trap" ? `${handNames[player]}の罠発動` :
        kind === "notice" ? `${handNames[player]}の予告状` :
        kind === "charge-recoil" ? `${handNames[player]}の反動` :
        kind === "emc2" ? `${handNames[player]}の手札誘発` :
        kind === "scout" ? `${handNames[player]}の偵察` :
        kind === "card-detail" ? "カード詳細" :
        kind === "accel" ? `${handNames[player]}の加速` :
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
        return match ? decodeURIComponent(match[1]).trim() : raw.replace(/[^a-zA-Z0-9_-]/g, "").trim().toUpperCase();
      }
    }

    function firebaseApi() {
      return window.WaribashiFirebase && window.WaribashiFirebase.ready ? window.WaribashiFirebase : null;
    }


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
      if (!state.pendingAdvanceNotice || typeof state.pendingAdvanceNotice !== "object") state.pendingAdvanceNotice = { human: [], cpu: [] };
      if (!state.activeDirectiveBlessing || typeof state.activeDirectiveBlessing !== "object") state.activeDirectiveBlessing = { human: 0, cpu: 0 };
      if (!state.pendingChargeStun || typeof state.pendingChargeStun !== "object") state.pendingChargeStun = { human: false, cpu: false };
      if (!state.pendingChargeStunSource || typeof state.pendingChargeStunSource !== "object") state.pendingChargeStunSource = { human: "", cpu: "" };
      if (!state.lightSpeedCircuitUsed || typeof state.lightSpeedCircuitUsed !== "object") state.lightSpeedCircuitUsed = { human: false, cpu: false };
      if (!state.costLimitNextTurn || typeof state.costLimitNextTurn !== "object") state.costLimitNextTurn = { human: null, cpu: null };
      if (!state.activeCostLimit || typeof state.activeCostLimit !== "object") state.activeCostLimit = { human: null, cpu: null };
      if (!state.firstTurnStarted || typeof state.firstTurnStarted !== "object") state.firstTurnStarted = { human: false, cpu: false };
      if (!state.temp || typeof state.temp !== "object") state.temp = {};
      for (const player of ["human", "cpu"]) {
        if (!state.temp[player] || typeof state.temp[player] !== "object") {
          state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
        }
        for (const key of ["pendingNoDraw", "activeNoDraw", "pendingAcceleration", "activeAcceleration", "extraActions", "berserkerTurns"]) {
          if (typeof state[key][player] !== "number" || Number.isNaN(state[key][player])) state[key][player] = 0;
        }
      }
    }

    function serializeFriendSide(player) {
      ensureOnlineStateMaps();
      return {
        L: state[player].L,
        R: state[player].R,
        traps: cloneJson(state.traps[player]),
        deck: [...state.decks[player]],
        hand: [...state.hands[player]],
        discard: [...state.discard[player]],
        temp: cloneJson(state.temp[player]),
        noSplit: !!state.noSplit[player],
        extraActions: Number(state.extraActions[player] || 0),
        pendingAcceleration: Number(state.pendingAcceleration[player] || 0),
        activeAcceleration: Number(state.activeAcceleration[player] || 0),
        pendingNoDraw: Number(state.pendingNoDraw?.[player] || 0),
        activeNoDraw: Number(state.activeNoDraw?.[player] || 0),
        pendingTerminalEnd: !!state.pendingTerminalEnd[player],
        pendingAdvanceNotice: cloneJson(state.pendingAdvanceNotice?.[player] || []),
        activeDirectiveBlessing: Number(state.activeDirectiveBlessing?.[player]) || 0,
        pendingChargeStun: !!state.pendingChargeStun?.[player],
        pendingChargeStunSource: String(state.pendingChargeStunSource?.[player] || ""),
        lightSpeedCircuitUsed: !!state.lightSpeedCircuitUsed?.[player],
        cheapBatteryDecay: Number(state.cheapBatteryDecay?.[player]) || 0,
        energyBarrier: Number(state.energyBarrier?.[player]) || 0,
        costLimitNextTurn: state.costLimitNextTurn[player] ?? null,
        activeCostLimit: state.activeCostLimit[player] ?? null,
        berserkerTurns: Number(state.berserkerTurns[player] || 0),
        firstTurnStarted: !!state.firstTurnStarted[player]
      };
    }

    function buildFriendCanonicalSnapshot() {
      const role = state.friendRole;
      if (!role) return null;
      const otherRole = otherFriendRole(role);
      const snapshot = {
        schemaVersion: 2,
        publisherSide: role,
        host: null,
        guest: null,
        turnSide: state.turn === "human" ? role : otherRole,
        turnNumber: state.turnNumber,
        gameOver: !!state.gameOver,
        result: state.matchResult ?? null,
        log: [...state.log],
        lastAction: state.lastAction ? cloneJson(state.lastAction) : null
      };
      snapshot[role] = serializeFriendSide("human");
      snapshot[otherRole] = serializeFriendSide("cpu");
      return snapshot;
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
      const ownedCheapBatteryDecay = Number(state.cheapBatteryDecay?.[player]) || 0;
      const ownedEnergyBarrier = Number(state.energyBarrier?.[player]) || 0;
      state[player] = { L: Number(side.L ?? 0), R: Number(side.R ?? 0) };
      state.traps[player] = cloneJson(side.traps || { L: [], R: [] });
      state.decks[player] = [...(side.deck || [])];
      state.hands[player] = [...(side.hand || [])];
      state.discard[player] = [...(side.discard || [])];
      state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ...(side.temp || {}) };
      if (preserveOwnerOnlyMeta) {
        state.temp[player].chargeCardsUsed = ownedChargeCardsUsed;
      } else if (!Array.isArray(state.temp[player].chargeCardsUsed)) {
        state.temp[player].chargeCardsUsed = [];
      }
      state.noSplit[player] = !!side.noSplit;
      state.extraActions[player] = Number(side.extraActions || 0);
      state.pendingAcceleration[player] = Number(side.pendingAcceleration || 0);
      state.activeAcceleration[player] = Number(side.activeAcceleration || 0);
      if (!state.pendingNoDraw) state.pendingNoDraw = { human: 0, cpu: 0 };
      if (!state.activeNoDraw) state.activeNoDraw = { human: 0, cpu: 0 };
      state.pendingNoDraw[player] = Number(side.pendingNoDraw || 0);
      state.activeNoDraw[player] = Number(side.activeNoDraw || 0);
      state.pendingTerminalEnd[player] = !!side.pendingTerminalEnd;
      state.pendingAdvanceNotice[player] = cloneJson(side.pendingAdvanceNotice || []);
      state.activeDirectiveBlessing[player] = Number(side.activeDirectiveBlessing) || 0;
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

    async function applyFriendCanonicalSnapshot(snapshot, revision = 0) {
      if (!snapshot || !state.friendRole) return;
      ensureOnlineStateMaps();
      if (state.friendPublishTimer) {
        clearTimeout(state.friendPublishTimer);
        state.friendPublishTimer = null;
      }
      if (revision && revision <= state.friendLastAppliedRevision) return;
      const previousTurn = state.turn;
      state.friendApplyingRemoteState = true;
      try {
        const publisherSide = snapshot.publisherSide || null;

        // 自分専用の使用済み・反動・今ターン使用カードは、
        // 相手が公開した全体スナップショットから上書きさせない。
        applyFriendSideToLocal("human", snapshot[state.friendRole], {
          preserveOwnerOnlyMeta: publisherSide !== state.friendRole
        });
        applyFriendSideToLocal("cpu", snapshot[otherFriendRole()], {
          preserveOwnerOnlyMeta: publisherSide === state.friendRole
        });
        state.turn = snapshot.turnSide === state.friendRole ? "human" : "cpu";
        state.turnNumber = Number(snapshot.turnNumber || 1);
        state.gameOver = !!snapshot.gameOver;
        state.matchResult = snapshot.result ?? state.matchResult ?? null;
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
        if (state.gameOver && state.matchResult) showBattleResult(state.matchResult);
      } finally {
        state.friendApplyingRemoteState = false;
      }

      if (!state.gameOver && previousTurn !== "human" && state.turn === "human") {
        await startTurn("human");
      } else if (!state.gameOver) {
        setMessage(state.turn === "human" ? "あなたの番です。" : "相手の番です。同期を待っています。");
        render();
      }
    }

    async function publishFriendStateNow() {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || state.friendApplyingRemoteState) return;
      const fb = firebaseApi();
      if (!fb) return;
      const snapshot = buildFriendCanonicalSnapshot();
      if (!snapshot) return;
      const signature = JSON.stringify(snapshot);
      if (signature === state.friendLastPublishedSignature) return;
      const nextRevision = Math.max(state.friendSyncRevision, state.friendLastAppliedRevision) + 1;
      state.friendSyncRevision = nextRevision;
      state.friendLastPublishedSignature = signature;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      // match 全体を古いキャッシュで上書きしない。更新するフィールドだけを原子的に書く。
      await fb.updateDoc(roomRef, {
        "match.version": 50,
        "match.stateRevision": nextRevision,
        "match.state": snapshot,
        "match.result": state.matchResult ?? null,
        updatedAt: fb.serverTimestamp()
      });
    }

    function canPublishFriendStateSafely() {
      if (state.battleMode !== "friend" || state.friendApplyingRemoteState || !state.friendMatchStarted) return false;
      // 通常の自動同期は、現在手番を持つ端末だけが書き込む。
      // ターンを相手へ渡す瞬間は endTurn() から明示的に publishFriendStateNow() を呼ぶ。
      if (state.turn !== "human") return false;
      if (state.animating || state.friendCardResolving || state.friendInterruptWaiting || state.friendInterruptHandling) return false;
      if (!["attack", "setupTrap"].includes(state.mode)) return false;
      if (state.pendingRepairDiscard || state.pendingEqualTradeSelf || state.pendingRapidFireDiscard || state.pendingSwapFirst) return false;
      if (state.pendingTrapTargetEffect || state.selectedTrapCardIndex !== null) return false;
      if (state.pendingTerminalEnd?.human || state.pendingTerminalEnd?.cpu) return false;
      return true;
    }

    function scheduleFriendStatePublish() {
      if (!canPublishFriendStateSafely()) return;
      if (state.friendPublishTimer) clearTimeout(state.friendPublishTimer);
      state.friendPublishTimer = setTimeout(() => {
        state.friendPublishTimer = null;
        publishFriendStateNow().catch(error => {
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
      const fb = firebaseApi();
      if (!fb) return;
      const fx = {
        id: `${state.friendRole}-fx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        sourceSide: state.friendRole,
        payload: cloneJson(payload),
        createdAtMs: Date.now()
      };
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.updateDoc(roomRef, {
        "match.version": 50,
        "match.fx": fx,
        updatedAt: fb.serverTimestamp()
      });
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

    async function writeFriendInterrupt(interrupt) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId) throw new Error("Firebaseに接続されていません。");
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      // 割り込みだけを書き換え、盤面 state / revision を古い値で巻き戻さない。
      await fb.updateDoc(roomRef, {
        "match.version": 50,
        "match.interrupt": interrupt,
        updatedAt: fb.serverTimestamp()
      });
    }

    async function requestRemoteFriendDecision(type, payload = {}) {
      if (state.battleMode !== "friend" || !state.friendRole) return null;
      if (state.friendInterruptWaiting) throw new Error("別のオンライン割り込み処理を待っています。");
      const id = makeFriendInterruptId();
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
          response = chosen ? { chosen: { placedHand: chosen.placedHand, index: chosen.index, cardId: chosen.cardId } } : { chosen: null };
        } else if (interrupt.type === "magicMirror") {
          const use = await askHumanMagicMirrorChoice("human", payload.hand || "L", payload.cardId);
          response = { use: !!use };
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
      return true;
    }

    function setFriendRoomUi(roomId, role = "host") {
      const cleanId = extractRoomId(roomId) || makeRoomId();
      const roomChanged = state.friendRoomId !== cleanId || state.friendRole !== role;
      state.battleMode = "friend";
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      state.friendRoomId = cleanId;
      state.friendRole = role;
      if (roomChanged) resetFriendMatchEntryState();
      state.friendRoomUrl = buildRoomUrl(cleanId);
      elements.roomUrlText.textContent = state.friendRoomUrl;
      elements.roomIdInput.value = cleanId;
      elements.copyRoomUrlBtn.disabled = false;
      history.replaceState(null, "", state.friendRoomUrl);
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
      const hostDeckOk = !!data?.hostDeckCounts;
      const guestDeckOk = !!data?.guestDeckCounts;
      if (elements.friendStartBattleBtn) {
        elements.friendStartBattleBtn.disabled = !(role === "host" && bothReady && hostDeckOk && guestDeckOk);
        elements.friendStartBattleBtn.textContent = role === "host" ? "共通画面で試合開始" : "ホストの試合開始を待っています";
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
        updateBattleResultPostMatchView(data?.postMatch);
        if (data?.postMatch) {
          resolveFriendPostMatchAsHost(data).catch(error => {
            console.error("PVP post-match resolve failed", error);
            setMessage(`試合後同期エラー：${error.message || error}`);
          });
          applyResolvedFriendPostMatch(data);
        }
        const remoteResult = data?.match?.result ?? data?.match?.state?.result ?? null;
        const remoteMatchId = data?.match ? getFriendMatchId(data.match) : null;
        const sameStartedMatch = state.friendMatchStarted && (!state.friendMatchId || state.friendMatchId === remoteMatchId);
        if ((data?.status === "playing" || data?.status === "post-match") && remoteResult && sameStartedMatch) {
          applySyncedBattleResult(remoteResult);
        }
        const fx = data?.match?.fx;
        if (fx) handleIncomingFriendFx(fx);
        const interrupt = data?.match?.interrupt;
        if (interrupt) {
          if (!consumeResolvedFriendInterrupt(interrupt)) {
            handleIncomingFriendInterrupt(interrupt).catch(error => {
              console.error("PVP interrupt receive failed", error);
              setMessage(`オンライン割り込みエラー：${error.message || error}`);
            });
          }
        }
        const incomingMatchId = data?.match ? getFriendMatchId(data.match) : null;
        const shouldEnterPlayingMatch = data?.status === "playing" && data?.match && (
          !state.friendMatchStarted ||
          state.friendMatchId !== incomingMatchId ||
          state.currentScreen !== "battle"
        );

        if (shouldEnterPlayingMatch) {
          try {
            enterFriendCommonBattle(data.match);
          } catch (error) {
            console.error("PVP battle entry failed", error);
            state.friendMatchStarted = false;
            state.friendMatchId = null;
            elements.friendLobbyMessage.textContent = `試合画面移行エラー：${error.message || error}`;
          }
        } else if (data?.status === "playing" && data?.match?.state && state.friendMatchStarted) {
          const revision = Number(data.match.stateRevision || 0);
          if (revision > state.friendLastAppliedRevision && revision > state.friendSyncRevision) {
            applyFriendCanonicalSnapshot(data.match.state, revision).catch(error => {
              console.error("PVP state apply failed", error);
              setMessage(`オンライン同期エラー：${error.message || error}`);
            });
          }
        }
      }, (error) => {
        console.error(error);
        elements.friendLobbyMessage.textContent = `Firebase同期エラー：${error.message || error}`;
      });
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
        hostClientId: getFriendClientId(),
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
      const clientId = getFriendClientId();

      try {
        await fb.runTransaction(fb.db, async (transaction) => {
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) {
            const error = new Error("ROOM_NOT_FOUND");
            error.code = "ROOM_NOT_FOUND";
            throw error;
          }

          const data = snapshot.data() || {};
          const sameGuest = !!data.guestJoined && data.guestClientId === clientId;
          const roomUnavailable = ["playing", "post-match"].includes(data.status);

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
            guestJoined: true,
            guestClientId: clientId,
            guestReady: sameGuest ? !!data.guestReady : false,
            guestLastSeen: fb.serverTimestamp(),
            status: data.status || "waiting"
          }, { merge: true });
        });
      } catch (error) {
        if (error?.code === "ROOM_NOT_FOUND" || error?.message === "ROOM_NOT_FOUND") {
          elements.friendLobbyMessage.textContent = "その部屋IDはまだ存在しません。ホストが部屋を作ってから入ってください。";
          return;
        }
        if (error?.code === "ROOM_FULL" || error?.message === "ROOM_FULL") {
          elements.friendLobbyMessage.textContent = "このルームはすでに2人参加しています。別のルームを作成してください。";
          return;
        }
        if (error?.code === "ROOM_IN_MATCH" || error?.message === "ROOM_IN_MATCH") {
          elements.friendLobbyMessage.textContent = "このルームではすでに対戦が進行中です。新しく参加することはできません。";
          return;
        }
        throw error;
      }

      setFriendRoomUi(roomId, "guest");
      elements.friendLobbyMessage.textContent = "Firebase上の部屋に入室しました。";
      subscribeFriendRoom(roomId);
    }

    async function setFriendReady(ready) {
      const fb = firebaseApi();
      if (!fb || !state.friendRoomId || !state.friendRole) return;
      const key = state.friendRole === "host" ? "hostReady" : "guestReady";
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      const deckKey = state.friendRole === "host" ? "hostDeckCounts" : "guestDeckCounts";
      await fb.setDoc(roomRef, {
        [key]: ready,
        [deckKey]: ready ? cloneValidDeckCounts(state.deckCounts.human) : null,
        updatedAt: fb.serverTimestamp(),
        status: ready ? "ready-check" : "waiting"
      }, { merge: true });
    }

    function friendPostMatchChoiceKey(role = state.friendRole) {
      return role === "host" ? "hostChoice" : "guestChoice";
    }

    function updateBattleResultPostMatchView(postMatch = state.friendRoomData?.postMatch) {
      if (!elements.battleResultPostActions) return;
      const isFriend = state.battleMode === "friend";
      elements.battleResultPostActions.classList.toggle("hidden", !isFriend);
      if (!isFriend) return;
      const myChoice = postMatch?.[friendPostMatchChoiceKey()] || state.friendPostMatchChoice || null;
      const otherChoice = postMatch?.[friendPostMatchChoiceKey(otherFriendRole())] || null;
      const labels = { rematch: "同じデッキで再戦", deck: "デッキ変更", lobby: "ロビーへ戻る" };
      elements.battleResultRematchBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      elements.battleResultDeckBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      elements.battleResultLobbyBtn.disabled = !!postMatch?.resolvedAction || state.friendPostMatchResolving;
      if (postMatch?.resolvedAction) {
        elements.battleResultWait.textContent = "試合後の移動を同期しています…";
      } else if (myChoice) {
        elements.battleResultWait.textContent = `あなた：${labels[myChoice]} / 相手：${otherChoice ? labels[otherChoice] : "選択待ち"}`;
      } else {
        elements.battleResultWait.textContent = "次の行動を選んでください。";
      }
    }

    async function requestFriendPostMatchChoice(choice) {
      if (state.battleMode !== "friend" || !state.friendRoomId || !state.friendRole || !state.gameOver) return;
      if (!["rematch", "deck", "lobby"].includes(choice)) return;
      const fb = firebaseApi();
      if (!fb) return;
      state.friendPostMatchChoice = choice;
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.updateDoc(roomRef, {
        [`postMatch.matchId`]: state.friendMatchId,
        [`postMatch.${friendPostMatchChoiceKey()}`]: choice,
        status: "post-match",
        updatedAt: fb.serverTimestamp()
      });
      updateBattleResultPostMatchView({
        ...(state.friendRoomData?.postMatch || {}),
        matchId: state.friendMatchId,
        [friendPostMatchChoiceKey()]: choice
      });
    }

    async function resolveFriendPostMatchAsHost(data) {
      if (state.friendRole !== "host" || state.friendPostMatchResolving) return;
      const post = data?.postMatch;
      if (!post || String(post.matchId || "") !== String(getFriendMatchId(data?.match) || "")) return;
      if (post.resolvedAction) return;
      const hostChoice = post.hostChoice || null;
      const guestChoice = post.guestChoice || null;
      let action = null;
      if (hostChoice === "lobby" || guestChoice === "lobby") action = "lobby";
      else if (hostChoice === "deck" || guestChoice === "deck") action = "deck";
      else if (hostChoice === "rematch" && guestChoice === "rematch") action = "rematch";
      if (!action) return;

      state.friendPostMatchResolving = true;
      try {
        if (action === "rematch") {
          await startFriendCommonBattle({ skipReady: true });
          return;
        }
        const fb = firebaseApi();
        if (!fb) return;
        const resolutionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
        await fb.updateDoc(roomRef, {
          "postMatch.resolvedAction": action,
          "postMatch.resolutionId": resolutionId,
          status: "waiting",
          hostReady: false,
          guestReady: false,
          updatedAt: fb.serverTimestamp()
        });
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
          showScreen("deck");
          setMessage("再戦用のあなたのデッキを編集してください。編集後はロビーへ戻り、準備完了を押してください。");
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
      state.friendMatchStarted = false;
      state.friendMatchId = null;
      state.friendSyncRevision = 0;
      state.friendLastAppliedRevision = 0;
      state.friendLastPublishedSignature = "";
      state.friendInterruptWaiting = null;
      state.friendInterruptHandling = false;
      state.friendHandledInterruptIds = new Set();
      state.matchResult = null;
      state.lastShownResultKey = null;
      state.friendResultPublishing = false;
      state.friendPostMatchChoice = null;
      state.friendPostMatchResolutionId = null;
      state.friendPostMatchResolving = false;
      state.friendDeckEditReturnToLobby = false;
      hideBattleResult();
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
      const skipReady = !!options.skipReady;
      if ((!skipReady && (!data?.hostReady || !data?.guestReady)) || !data?.hostDeckCounts || !data?.guestDeckCounts) {
        elements.friendLobbyMessage.textContent = "2人の準備完了とデッキ提出が必要です。";
        return;
      }
      const fb = firebaseApi();
      if (!fb) return;
      const hostDeck = shuffle(buildDeckFromSubmittedCounts(data.hostDeckCounts));
      const guestDeck = shuffle(buildDeckFromSubmittedCounts(data.guestDeckCounts));
      const initialHost = { L: 1, R: 1, deckCounts: data.hostDeckCounts, deck: hostDeck.slice(3), hand: hostDeck.slice(0, 3), discard: [] };
      const initialGuest = { L: 1, R: 1, deckCounts: data.guestDeckCounts, deck: guestDeck.slice(3), hand: guestDeck.slice(0, 3), discard: [] };
      const emptySideState = (side) => ({
        L: side.L, R: side.R, traps: { L: [], R: [] }, deck: side.deck, hand: side.hand, discard: side.discard,
        temp: { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, chargeCardsUsed: [] },
        noSplit: false, extraActions: 0, pendingAcceleration: 0, activeAcceleration: 0, pendingNoDraw: 0, activeNoDraw: 0, pendingTerminalEnd: false,
        costLimitNextTurn: null, activeCostLimit: null, berserkerTurns: 0, firstTurnStarted: false
      });
      const createdAtMs = Date.now();
      const match = {
        version: 49,
        matchId: `${state.friendRoomId}-${createdAtMs}-${Math.random().toString(36).slice(2, 8)}`,
        createdAtMs,
        turnSide: "host",
        turnNumber: 1,
        host: initialHost,
        guest: initialGuest,
        stateRevision: 1,
        state: {
          schemaVersion: 1,
          host: emptySideState(initialHost),
          guest: emptySideState(initialGuest),
          turnSide: "host",
          turnNumber: 1,
          gameOver: false,
          result: null,
          log: ["オンライン対戦を開始しました。"],
          lastAction: null
        },
        result: null
      };
      const roomRef = fb.doc(fb.db, "rooms", state.friendRoomId);
      await fb.setDoc(roomRef, {
        status: "playing",
        match,
        postMatch: null,
        updatedAt: fb.serverTimestamp()
      }, { merge: true });

      // ホストはonSnapshot待ちだけに依存せず、書き込み成功後に同じmatchへ確実に入る。
      const startedMatchId = getFriendMatchId(match);
      if (!state.friendMatchStarted || state.friendMatchId !== startedMatchId || state.currentScreen !== "battle") {
        enterFriendCommonBattle(match);
      }
    }

    function enterFriendCommonBattle(match) {
      const mine = state.friendRole === "host" ? match.host : match.guest;
      const other = state.friendRole === "host" ? match.guest : match.host;
      state.battleMode = "friend";
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      handNames.cpu = "相手";
      state.friendMatchStarted = true;
      state.friendMatchId = getFriendMatchId(match) || String(Date.now());
      state.friendSyncRevision = Number(match.stateRevision || 0);
      state.friendLastAppliedRevision = Number(match.stateRevision || 0);
      state.friendLastPublishedSignature = match.state ? JSON.stringify(match.state) : "";
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
      state.temp.human = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.temp.cpu = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
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
      state.turn = match.turnSide === state.friendRole ? "human" : "cpu";
      state.turnNumber = match.turnNumber || 1;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.animating = false;
      state.gameOver = false;
      state.matchResult = match.result ?? null;
      state.lastShownResultKey = null;
      hideBattleResult();
      state.log = [
        "オンライン共通戦闘画面に入りました。ゲーム状態同期を開始します。",
        "光速回路の一試合一度状態は、host・guestそれぞれの所有状態として管理されます。"
      ];
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      clearHighlights();
      showScreen("battle");
      if (match.state) {
        state.friendApplyingRemoteState = true;
        const snapshot = match.state;
        applyFriendSideToLocal("human", snapshot[state.friendRole]);
        applyFriendSideToLocal("cpu", snapshot[otherFriendRole()]);
        state.turn = snapshot.turnSide === state.friendRole ? "human" : "cpu";
        state.turnNumber = Number(snapshot.turnNumber || 1);
        state.gameOver = !!snapshot.gameOver;
        state.matchResult = snapshot.result ?? match.result ?? null;
        state.log = [...(snapshot.log || [])];
        state.lastAction = snapshot.lastAction ? cloneJson(snapshot.lastAction) : null;
        state.friendApplyingRemoteState = false;
      }
      setMessage(state.gameOver ? "試合終了。" : state.turn === "human" ? "あなたの番です。CPU戦と同じ画面・カード処理を使用します。" : "相手の番です。同期を待っています。");
      render();
      if (state.gameOver && state.matchResult) showBattleResult(state.matchResult);
      if (state.turn === "human" && !state.firstTurnStarted.human) {
        startTurn("human");
      }
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
      state.decks.human = [];
      state.decks.cpu = [];
      state.discard.human = [];
      state.discard.cpu = [];
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

    function startBattleWithDifficulty(difficulty) {
      if (!areBothDecksValid()) {
        const h = getDeckStats("human");
        const c = getDeckStats("cpu");
        showScreen("deck");
        if (h.count !== DECK_MAX_COUNT || c.count !== DECK_MAX_COUNT) setMessage(`対戦前に、あなた用・CPU用の両方をちょうど${DECK_MAX_COUNT}枚にしてください。`);
        else setMessage("対戦前に、あなた用・CPU用のどちらかのコストを40以内にしてください。");
        return;
      }
      state.battleMode = "cpu";
      state.tutorialBattleActive = false;
      state.tutorialScriptedCpuAction = false;
      tutorial.usingRealBattle = false;
      elements.realTutorialOverlay?.classList.add("hidden");
      handNames.cpu = "CPU";
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
          <p>「乱舞」で本数を揃えた結果は、その攻撃自身の共鳴には数えません。</p>`
      }
    };

    function openDeckInfo(infoKey) {
      const preset = DECK_INFO[infoKey];
      const card = CARD_LIBRARY[infoKey];
      if (!preset && !card) return;
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
      elements.deckInfoModal.classList.remove("show");
      elements.deckInfoModal.setAttribute("aria-hidden", "true");
    }

    function normalizeDeckSearchText(value) {
      return String(value || "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, " ").trim();
    }

    function deckCardSearchText(cardId, card) {
      return normalizeDeckSearchText([
        cardId, card.name, card.type, card.text,
        card.trap ? "罠" : "", card.blessing ? "加護" : "",
        card.curse ? "呪縛" : "", card.chargeCard ? "充電" : "",
        card.directive ? "指令" : "", card.token ? "生成カード" : ""
      ].join(" "));
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
      const nameQuery = normalizeDeckSearchText(state.deckNameSearch);
      const keywordQuery = normalizeDeckSearchText(state.deckKeywordSearch);

      const visible = implementationIds.filter(cardId => {
        const card = CARD_LIBRARY[cardId];
        if (nameQuery && !normalizeDeckSearchText(card.name).includes(nameQuery)) return false;
        if (keywordQuery && !deckCardSearchText(cardId, card).includes(keywordQuery)) return false;
        return true;
      });

      visible.sort((a, b) => {
        const cardA = CARD_LIBRARY[a];
        const cardB = CARD_LIBRARY[b];
        const tokenDiff = Number(Boolean(cardA.token)) - Number(Boolean(cardB.token));
        if (tokenDiff) return tokenDiff;
        if (state.deckSortMode === "name") return cardA.name.localeCompare(cardB.name, "ja");
        if (state.deckSortMode === "cost") return cardA.cost - cardB.cost || cardA.name.localeCompare(cardB.name, "ja");
        if (state.deckSortMode === "type") return deckCardTypeSortKey(cardA).localeCompare(deckCardTypeSortKey(cardB), "ja");
        return implementationIndex.get(a) - implementationIndex.get(b);
      });
      return visible;
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
                <div class="deck-detail-card-row">
                  <div>
                    <div class="deck-detail-card-name">${escapeHtml(entry.card.name)}</div>
                    <div class="deck-detail-card-meta">${escapeHtml(entry.card.type)} / コスト${entry.card.cost}</div>
                  </div>
                  <strong class="deck-detail-card-count">×${entry.count}</strong>
                </div>`).join("")}
            </div>
          </section>`;
      }).join("");

      elements.deckInfoKicker.textContent = "CURRENT DECK";
      elements.deckInfoTitle.textContent = `${owner === "human" ? "あなた用" : "CPU用"}デッキ詳細`;
      elements.deckInfoBody.innerHTML = `
        <div class="deck-detail-summary">
          <span>${stats.count}枚</span><span>合計コスト ${stats.cost} / ${state.costLimit}</span><span>${entries.length}種類</span>
        </div>
        ${sectionHtml || '<div class="deck-detail-empty">デッキにカードが入っていません。</div>'}`;
      elements.deckInfoModal.classList.add("show");
      elements.deckInfoModal.setAttribute("aria-hidden", "false");
    }

    function renderDeckBuilder() {
      const owner = state.editingDeckOwner;
      const counts = currentDeckCounts(owner);
      elements.deckGrid.innerHTML = "";
      const visibleCardIds = getVisibleDeckCardIds();
      visibleCardIds.forEach(cardId => {
        const card = CARD_LIBRARY[cardId];
        const count = counts[cardId] || 0;
        const row = document.createElement("div");
        row.className = "deck-row" + (card.blessing ? " blessing-card" : card.curse ? " curse-card" : "") + (card.token ? " generated-card" : "");
        const relatedButtons = [];
        if (cardId === "focusedShot") relatedButtons.push('<button class="deck-inline-info" data-info="logicCrusherBullet">生成カード「ロジックアトリエ」を確認</button>');
        if (cardId === "lastMelody") relatedButtons.push('<button class="deck-inline-info" data-info="finale">生成カード「フィナーレ」を確認</button>');
        if (["allegro", "resonanceTuning", "crescendo", "dance", "largo", "andante", "lastMelody"].includes(cardId)) relatedButtons.push('<button class="deck-inline-info" data-info="resonance">共鳴とは？</button>');
        const relatedButton = relatedButtons.join("");
        row.innerHTML = `
          <div>
            <div class="card-title">
              <span class="deck-card-name">${escapeHtml(card.name)}</span>
            </div>
            <div class="card-label-row">
              <span class="card-type${card.trap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
              ${card.token ? '<span class="generated-badge">生成カード</span>' : ''}
            </div>
            <div class="card-cost">コスト ${card.cost}</div>
            <div class="deck-card-desc">${card.directive ? directiveCardTextHtml(cardId, card) : escapeHtml(card.text)}</div>
            <div class="deck-inline-actions">${relatedButton}${card.token ? `<button class="deck-inline-info" data-info="${cardId}">詳細を見る</button>` : ""}</div>
          </div>
          ${card.token ? '<div class="generated-lock">デッキ投入不可</div>' : `<div class="count-control">
            <button class="secondary" data-action="minus" data-card="${cardId}">−</button>
            <span class="count-num">${count}</span>
            <button data-action="plus" data-card="${cardId}">＋</button>
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

          const cardId = btn.dataset.card;
          const action = btn.dataset.action;
          if (!cardId || !action) return;

          const current = counts[cardId] || 0;
          if (action === "plus") {
            const currentStats = getDeckStats(owner);
            if (currentStats.count >= DECK_MAX_COUNT) {
              setMessage(`デッキはちょうど${DECK_MAX_COUNT}枚です。これ以上追加できません。`);
              return;
            }
            counts[cardId] = Math.min(3, current + 1);
          } else if (action === "minus") {
            counts[cardId] = Math.max(0, current - 1);
          }
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
      if (elements.deckNameSearchInput && elements.deckNameSearchInput.value !== state.deckNameSearch) elements.deckNameSearchInput.value = state.deckNameSearch;
      if (elements.deckKeywordSearchInput && elements.deckKeywordSearchInput.value !== state.deckKeywordSearch) elements.deckKeywordSearchInput.value = state.deckKeywordSearch;
      if (elements.deckSearchResultText) {
        const total = Object.keys(CARD_LIBRARY).length;
        const hasSearch = !!(state.deckNameSearch || state.deckKeywordSearch);
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


    const DIRECTIVE_BASE_IDS = ["directiveAttack", "directiveTarget", "directiveSilence", "directiveReform"];

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

    function makeDirectiveVariant(baseId) {
      if (baseId === "directiveAttack") {
        const hand = Math.random() < 0.5 ? "L" : "R";
        const id = `directiveAttack_${hand}`;
        if (!CARD_LIBRARY[id]) {
          CARD_LIBRARY[id] = {
            ...CARD_LIBRARY.directiveAttack,
            name: `指令：指定攻撃［${directiveHandLabel(hand)}］`,
            text: `指定：${directiveHandLabel(hand)}手で攻撃。凶弾も可。達成：1枚引く。未達成：手札をランダムに1枚捨てる。`,
            directive: true,
            directiveBase: "directiveAttack",
            directiveData: { attackHand: hand },
            token: true
          };
        }
        return id;
      }
      if (baseId === "directiveTarget") {
        const attackHand = Math.random() < 0.5 ? "L" : "R";
        const targetHand = Math.random() < 0.5 ? "L" : "R";
        const id = `directiveTarget_${attackHand}_${targetHand}`;
        if (!CARD_LIBRARY[id]) {
          CARD_LIBRARY[id] = {
            ...CARD_LIBRARY.directiveTarget,
            name: `指令：対象指定［${directiveHandLabel(attackHand)}→${directiveHandLabel(targetHand)}］`,
            text: `指定：${directiveHandLabel(attackHand)}手 → ${directiveHandLabel(targetHand)}手を攻撃。凶弾も可。達成：2枚引く。未達成：指定された自分の手に1本加える。`,
            directive: true,
            directiveBase: "directiveTarget",
            directiveData: { attackHand, targetHand },
            token: true
          };
        }
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
            name: `指令：指定攻撃［${directiveHandLabel(hand)}］`,
            text: `指定：${directiveHandLabel(hand)}手で攻撃。凶弾も可。達成：1枚引く。未達成：手札をランダムに1枚捨てる。`,
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
              name: `指令：対象指定［${directiveHandLabel(attackHand)}→${directiveHandLabel(targetHand)}］`,
              text: `指定：${directiveHandLabel(attackHand)}手 → ${directiveHandLabel(targetHand)}手を攻撃。凶弾も可。達成：2枚引く。未達成：指定された自分の手に1本加える。`,
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
        const options = state.hands[player]
          .map((id, index) => ({ id, index }))
          .filter(x => !isDirectiveCard(x.id));
        if (options.length) {
          const picked = options[Math.floor(Math.random() * options.length)];
          const [discarded] = state.hands[player].splice(picked.index, 1);
          state.discard[player].push(discarded);
          await handleCardDiscardEffect(player, discarded);
        }
      } else if (base === "directiveTarget") {
        const hand = card.directiveData?.attackHand;
        if (hand) await addFingersWithCalculation(player, hand, 1, "指令未達成");
      } else if (base === "directiveSilence") {
        state.pendingDirectiveNoDraw[player] = (state.pendingDirectiveNoDraw[player] || 0) + 1;
      } else if (base === "directiveReform") {
        let hand;
        if (state[player].L === state[player].R) hand = Math.random() < 0.5 ? "L" : "R";
        else hand = state[player].L > state[player].R ? "L" : "R";
        await addFingersWithCalculation(player, hand, 1, "指令未達成");
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
        (directiveWasCleared(player, item.id) ? cleared : failed).push(item);
      }

      const removeIndexes = directives.map(x => x.index).sort((a, b) => b - a);
      for (const index of removeIndexes) {
        const [id] = state.hands[player].splice(index, 1);
        state.discard[player].push(id);
      }

      for (const item of cleared) {
        addLog(`【指令】「${CARD_LIBRARY[item.id].name}」達成。`);
        const base = directiveBaseId(item.id);
        if (base === "directiveAttack") drawCard(player);
        else if (base === "directiveTarget") {
          drawCard(player);
          drawCard(player);
        } else if (base === "directiveSilence") {
          drawCard(player);
          drawCard(player);
        } else if (base === "directiveReform") {
          state.pendingDirectiveBonusDraw[player] = (state.pendingDirectiveBonusDraw[player] || 0) + 1;
        }
      }

      for (const item of failed) {
        addLog(`【指令】「${CARD_LIBRARY[item.id].name}」未達成。`);
        await applyDirectiveFailure(player, item.id);
      }

      state.lastDirectiveClearCount[player] = cleared.length;
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
    }

    function drawDirectiveFromDeck(player) {
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
    function countDiscardableHand(player){ return state.hands[player].filter(id=>!isProtectedChargeCard(id)).length; }
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
    function resolveDimensionalSlash(player, hand) {
      const charge = getChargeLevel(player);
      if (charge < 5) {
        addLog(`${handNames[player]}の「空間切断」は充電不足で不発。`);
        state.mode = "attack";
        render();
        return false;
      }

      if (hand) {
        if (state[player][hand] <= 0) {
          addLog(`${handNames[player]}の「空間切断」は、代償にする手がすでに0だったため発動しなかった。`);
          state.mode = "dimensionalSlashSacrifice";
          render();
          return false;
        }
        state[player][hand] = 0;
        clearHandAttachments(player, hand);
        addLog(`${handNames[player]}は「空間切断」の代償として${handNames[hand]}を0にした。`);
      }

      consumeCharge(player, 5, false, "空間切断");
      state.temp[player].dimensionalSlashBonus =
        (state.temp[player].dimensionalSlashBonus || 0) + 1;
      state.temp[player].attackLimit =
        Math.max(2, state.temp[player].attackLimit || 1);
      state.mode = "attack";
      setMessage("「空間切断」：このターン、通常攻撃を2回まで行えます。");
      render();
      return true;
    }

    function isEffectCopyExcluded(cardId, source = "") {
      if (!cardId) return true;
      if (isDirectiveCard(cardId)) return true;
      if (isProtectedChargeCard(cardId)) return true;
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
          return card && typeof card.effect === "function" && !isEffectCopyExcluded(item.cardId, "brawl");
        });
    }

    function getAdvanceNoticeCandidates(player) {
      return state.hands[player]
        .map((cardId, index) => ({ cardId, index }))
        .filter(item => {
          const card = CARD_LIBRARY[item.cardId];
          if (!card || typeof card.effect !== "function" || isEffectCopyExcluded(item.cardId, "advanceNotice")) return false;
          if (!canUseChargeCardThisTurn(player, item.cardId)) return false;
          try {
            return !!card.canPlay(player);
          } catch {
            return false;
          }
        });
    }

    async function activateCopiedCardEffect(player, cardId, sourceLabel) {
      const card = CARD_LIBRARY[cardId];
      if (!card || typeof card.effect !== "function") {
        addLog(`${sourceLabel}で選ばれたカードには発動できる効果がなかった。`);
        return false;
      }

      // 乱闘・予告状の発動は「カードの効果だけを使う」ため、
      // 充電カードの1ターン1回制限を確認せず、使用済みにも記録しない。
      const previousCopy = state.copiedEffectContext;
      state.copiedEffectContext = { sourceLabel, cardId };
      try {
        await card.effect(player);
        if (card.terminal && !state.pendingTerminalEnd[player] && state.mode === "attack") {
          state.pendingTerminalEnd[player] = true;
        }
        return true;
      } finally {
        state.copiedEffectContext = previousCopy;
      }
    }

    async function chooseAdvanceNoticeCard(player, handIndex) {
      if (state.mode === "advanceNoticeChoose" && player === "human" && state.turn !== "human") return false;
      const cardId = state.hands[player][handIndex];
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
      state.hands[player].splice(handIndex, 1);
      state.discard[player].push(cardId);
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
        addLog(`【予告状】${handNames[player]}が予告した「${card.name}」の効果が発動する。`);
        await showCardPopup(player, card, false, player === "cpu" ? 760 : 650);
        await activateCopiedCardEffect(player, cardId, "予告状");
        if (state.gameOver || state.pendingTerminalEnd[player] || state.mode !== "attack") break;
      }
    }

    function drawCard(player) {
      if (state.decks[player].length > 0) {
        const cardId = state.decks[player].pop();
        state.hands[player].push(materializeDrawnCard(cardId));
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
      // 「指令の加護」は直前の相手ターンだけ有効。自分の新しいターン開始時に失効する。
      if (state.activeDirectiveBlessing) state.activeDirectiveBlessing[player] = 0;
      ensureOnlineStateMaps();
      if (!state.firstTurnStarted) state.firstTurnStarted = { human: false, cpu: false };
      if (!state.pendingNoDraw) state.pendingNoDraw = { human: 0, cpu: 0 };
      if (!state.activeNoDraw) state.activeNoDraw = { human: 0, cpu: 0 };
      state.firstTurnStarted[player] = true;
      state.temp[player] = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.turn = player;
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.selectedTrapCardIndex = null;
      state.pendingTrapTargetEffect = null;
      state.pendingRepairDiscard = null;
      state.pendingEqualTradeSelf = null;
      state.pendingRapidFireDiscard = null;
      elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
      clearHighlights();

      state.pendingTerminalEnd[player] = false;
      state.activeCostLimit[player] = state.costLimitNextTurn[player];
      state.costLimitNextTurn[player] = null;
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
        addLog(`${handNames[player]}はバーサーカー状態。攻撃+2、カード使用・罠設置・分ける不可。残り${state.berserkerTurns[player]}ターン。`);
      }

      let draws = 1;
      if ((state.pendingDirectiveNoDraw[player] || 0) > 0) {
        state.pendingDirectiveNoDraw[player] -= 1;
        draws = 0;
        addLog(`${handNames[player]}は未達成の「指令：沈黙」により、このターンの通常ドローを行わない。`);
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

      for (let i = 0; i < draws; i++) drawCard(player);

      await resolveAdvanceNotice(player);
      if (state.pendingChargeStun[player]) {
        const recoilSource = state.pendingChargeStunSource?.[player] || "充電効果";

        // 予約された反動は、次の自分ターン開始時にだけ消費する。
        state.pendingChargeStun[player] = false;
        state.pendingChargeStunSource[player] = "";

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
        await endTurn();
        return;
      }
      if (state.pendingTerminalEnd[player]) {
        state.pendingTerminalEnd[player] = false;
        await endTurn();
        return;
      }
      if (state.mode !== "attack") {
        render();
        return;
      }

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
            if (state.mode === "andante" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "chargeTargetOwn" && player === "human" && value > 0) {
              card.classList.add("trap-target");
            }
            if (state.mode === "chargeTargetOpponent" && player === "cpu" && value > 0) {
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

      if (elements.battleRestartBtn) {
        elements.battleRestartBtn.classList.toggle("screen-hidden", state.battleMode === "friend");
      }
      if (elements.battleResultReopenBtn) {
        elements.battleResultReopenBtn.classList.toggle("screen-hidden", !(state.battleMode === "friend" && state.gameOver && state.matchResult));
      }
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
      if (cardId === "duelSurge") {
        instance.level = 0;
        instance.duelTargetOwner = null;
        instance.duelTargetHand = null;
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
      const candidates=state.hands[player].map((cardId,index)=>({cardId,index})).filter(x=>!isProtectedChargeCard(x.cardId));
      if(!candidates.length) return null;
      const picked=candidates[Math.floor(Math.random()*candidates.length)];
      const [cardId]=state.hands[player].splice(picked.index,1); state.discard[player].push(cardId); return cardId;
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
      const hasDiscardEffect = ["accelBullet", "specialBullet", "pierceBullet"].includes(cardId);
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
        const discarded = discardOneCard(opponent);
        addLog(`${handNames[player]}の「特殊弾」効果。${handNames[opponent]}は${discarded ? `「${CARD_LIBRARY[discarded].name}」` : "手札"}を1枚捨てた。`);
        if (discarded) await handleCardDiscardEffect(opponent, discarded);
      } else if (cardId === "pierceBullet") {
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

    function hasBulletproofVest(player, hand) {
      return hasAttachment(player, hand, "bulletproofVest");
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
      if (hasBulletproofVest(defender, targetHand)) {
        await triggerBulletproofBlockedFx(defender, "狙撃");
        addLog(`${handNames[defender]}の${handNames[targetHand]}にある「防弾チョッキ」が「狙撃」を防いだ。`);
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
        elements.attachmentDetailText.textContent = card.text;
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
          const hidden = isTrap && player === "cpu" && !revealed && !exposedByCurse;
          const publiclyRevealed = isTrap && player === "cpu" && !hidden;
          const ownVisibleTrap = isTrap && player === "human";
          div.className =
            "trap-slot filled" +
            (hidden ? " cpu-hidden" : "") +
            (publiclyRevealed ? " revealed-trap-slot" : "") +
            (ownVisibleTrap ? " own-trap-slot" : "") +
            (card?.blessing ? " blessing-slot" : "") +
            (card?.curse ? " curse-slot" : "") +
            (selectable ? " selectable-trap-card" : "");
          const kindInfo = attachmentKindInfo(card, { publiclyRevealed });
          const displayName = cardId === "duelSurge" ? `${card.name} Lv.${Number(slot?.level) || 0}` : card.name;
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

      if (base === "directiveAttack") {
        return `<div class="directive-summary">
          <span class="directive-label">指定</span>
          <span class="directive-hand">${escapeHtml(directiveHandLabel(data.attackHand))}</span>
          <span class="directive-action">手で攻撃</span>
        </div>
        <div class="directive-note">通常攻撃 / 凶弾で達成可能</div>
        <div class="directive-result"><strong>達成</strong> 1枚引く</div>
        <div class="directive-result fail"><strong>未達成</strong> ランダム1枚捨てる</div>`;
      }

      if (base === "directiveTarget") {
        return `<div class="directive-summary">
          <span class="directive-label">指定</span>
          <span class="directive-hand">${escapeHtml(directiveHandLabel(data.attackHand))}</span>
          <span class="directive-arrow">→</span>
          <span class="directive-target">${escapeHtml(directiveHandLabel(data.targetHand))}手</span>
        </div>
        <div class="directive-note">通常攻撃 / 凶弾で達成可能</div>
        <div class="directive-result"><strong>達成</strong> 2枚引く</div>
        <div class="directive-result fail"><strong>未達成</strong> 指定した自分の手+1</div>`;
      }

      if (base === "directiveSilence") {
        return `<div class="directive-summary">
          <span class="directive-label">条件</span>
          <span class="directive-keyword">カード使用禁止</span>
        </div>
        <div class="directive-result"><strong>達成</strong> 2枚引く</div>
        <div class="directive-result fail"><strong>未達成</strong> 次ターン通常ドローなし</div>`;
      }

      if (base === "directiveReform") {
        return `<div class="directive-summary">
          <span class="directive-label">条件</span>
          <span class="directive-keyword">分ける</span>
        </div>
        <div class="directive-result"><strong>達成</strong> 次ターン開始時ドロー+1</div>
        <div class="directive-result fail"><strong>未達成</strong> 多い方の手+1</div>`;
      }

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
        const cityWillMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "cityWillChoose";
        const advanceNoticeMode = state.turn === "human" && !state.gameOver && !state.animating && state.mode === "advanceNoticeChoose";
        const restrictedByCost = state.activeCostLimit.human !== null && card.cost > state.activeCostLimit.human;
        const berserkLocked = state.berserkerTurns.human > 0 && !state.temp.human.berserkerJustUsed;
        const baseCardActionAvailable =
          state.turn === "human" &&
          !state.gameOver &&
          !state.animating &&
          !state.temp.human.cardActionUsed &&
          !berserkLocked;
        const lightSpeedChargePlayable =
          state.turn === "human" &&
          !state.gameOver &&
          !state.animating &&
          !berserkLocked &&
          canUseChargeCardDuringLightSpeed("human", cardId);
        const chargeCardAvailableThisTurn = canUseChargeCardThisTurn("human", cardId);
        const canUseCardAction = (baseCardActionAvailable || lightSpeedChargePlayable) && chargeCardAvailableThisTurn;
        const normalPlayable =
          !repairDiscardMode &&
          !calmDownDiscardMode &&
          !rapidFireDiscardMode &&
          !cityWillMode &&
          !advanceNoticeMode &&
          !restrictedByCost &&
          canUseCardAction &&
          !isZoneCard &&
          card.canPlay("human");
        const trapPlayable =
          !repairDiscardMode &&
          !calmDownDiscardMode &&
          !rapidFireDiscardMode &&
          !cityWillMode &&
          !advanceNoticeMode &&
          !restrictedByCost &&
          !berserkLocked &&
          (((baseCardActionAvailable || lightSpeedChargePlayable) && isZoneCard && !setupActive) || (setupActive && isTrap)) &&
          canSetAttachmentTarget("human", cardId);
        const discardPlayable = repairDiscardMode && cardId !== "repair";
        const calmDiscardPlayable = calmDownDiscardMode && cardId !== "calmDown";
        const rapidDiscardPlayable = rapidFireDiscardMode && cardId !== "rapidFire";
        const cityWillPlayable = cityWillMode && isDirectiveCard(cardId);
        const advanceNoticePlayable = advanceNoticeMode && getAdvanceNoticeCandidates("human").some(item => item.index === index);
        const selected = state.selectedTrapCardIndex === index;
        const div = document.createElement("div");
        div.className =
          "game-card" +
          (card.blessing ? " blessing-card" : "") +
          (card.curse ? " curse-card" : "") +
          (card.directive ? " directive-card" : "") +
          (normalPlayable ? " playable" : "") +
          (trapPlayable ? " trap-playable" : "") +
          (discardPlayable || calmDiscardPlayable || rapidDiscardPlayable || cityWillPlayable || advanceNoticePlayable ? " playable" : "") +
          (selected ? " selected-card" : "") +
          (displaySettings.compactCardDescriptions ? " compact-description-card" : "");
        div.innerHTML = `
          <div class="card-title">
            <span class="card-name">${escapeHtml(card.name)}</span>
          </div>
          <div class="card-label-row">
            <span class="card-type${isTrap ? " trap" : card.blessing ? " blessing" : card.curse ? " curse" : ""}">${escapeHtml(card.type)}</span>
          </div>
          <div class="card-cost">コスト ${card.cost}</div>
          ${displaySettings.compactCardDescriptions
            ? '<div class="card-long-press-hint">長押しで効果を表示</div>'
            : `<div class="card-text">${card.directive ? directiveCardTextHtml(cardId, card) : escapeHtml(card.text)}</div>`}
          ${advanceNoticePlayable ? '<div class="used">予告状：公開して予約</div>' : cityWillPlayable ? '<div class="used">都市の意志：相手に渡す</div>' : discardPlayable ? '<div class="used">補修：このカードを捨てる</div>' : calmDiscardPlayable ? '<div class="used">落ち着ける：このカードを捨てる</div>' : rapidDiscardPlayable ? '<div class="used">乱射：このカードを捨てる</div>' : restrictedByCost ? '<div class="used">倹約令：使用不可</div>' : berserkLocked ? '<div class="used">バーサーカー中：使用不可</div>' : state.temp.human.setupMode && isTrap ? '<div class="used">仕込み中：設置可能</div>' : cardId === "lightSpeedCircuit" && state.lightSpeedCircuitUsed.human
            ? '<div class="used charge-match-used">光速回路はこの試合で発動済み</div>'
            : hasUsedChargeCardThisTurn("human", cardId)
              ? '<div class="used charge-once-used">この充電カードは今ターン使用済み</div>'
            : state.temp.human.cardActionUsed
              ? (lightSpeedChargePlayable
                  ? '<div class="used charge-ready">光速回路：充電カード使用可能</div>'
                  : '<div class="used">カード関連行動は使用済み</div>')
              : ''}
        `;
        attachCardLongPress(div, cardId);
        if (discardPlayable) {
          div.addEventListener("click", () => chooseRepairDiscard(index));
        }
        if (calmDiscardPlayable) {
          div.addEventListener("click", () => chooseCalmDownDiscard(index));
        }
        if (rapidDiscardPlayable) {
          div.addEventListener("click", () => chooseRapidFireDiscard(index));
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
        (state.temp.human.cardActionUsed && !state.temp.human.setupMode && !lightSpeedChargePlayable)
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
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed(player, cardId);
      if (!canUseChargeCardThisTurn(player, cardId)) {
        if (player === "human") setMessage(`「${card.name}」はこのターンすでに使用しています。`);
        return false;
      }
      if (
        state[owner][hand] <= 0 ||
        state.traps[owner][hand].length >= 2 ||
        (state.temp[player].cardActionUsed && !setupActive && !lightSpeedChargePlayable)
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
      render();

      // 罠・加護・呪縛は、対象の手を選んで設置できた後に
      // tutorialAfterHandClick 側で次のステップへ進む。

      // 罠・加護・呪縛の設置は相手側の表示に直結するため、オンラインでは即時同期する。
      if (state.battleMode === "friend" && player === "human" && !state.friendApplyingRemoteState) {
        await publishFriendStateNow();
      }
      return true;
    }

    async function playCard(player, handIndex, showPopup = true) {
      if (state.gameOver || state.turn !== player) return false;

      const cardId = state.hands[player][handIndex];
      const card = CARD_LIBRARY[cardId];

      if (isTutorialBattle() && player === "human" && tutorial.expected !== `card:${cardId}`) {
        setMessage("今は黄色く光っているカードだけを使ってください。");
        return false;
      }
      const lightSpeedChargePlayable = canUseChargeCardDuringLightSpeed(player, cardId);
      if (state.temp[player].cardActionUsed && !lightSpeedChargePlayable) return false;
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

      if (state.battleMode === "friend") state.friendCardResolving = true;
      state.hands[player].splice(handIndex, 1);
      state.discard[player].push(cardId);
      markChargeCardUsedThisTurn(player, cardId);
      state.temp[player].cardActionUsed = true;
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

      await card.effect(player);
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
        } else if (cardId === "calmDown" && state.mode === "calmDownDiscard") {
          setMessage("「落ち着ける」：捨てる手札を1枚選んでください。");
        } else if (cardId === "andante" && state.mode === "andante") {
          setMessage("「アンダンテ」：微調整する自分の0でない手を選んでください。");
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
        const response = await requestRemoteFriendDecision("manualTrap", {
          candidates: candidates.map(info => ({ placedHand: info.placedHand, index: info.index, cardId: info.cardId })),
          attackHand: context.attackHand,
          targetHand: context.targetHand,
          isRapidFire: !!context.isRapidFire,
          timing: context.resolvedFinal !== undefined ? "after" : "before"
        });
        const chosen = response?.chosen;
        if (!chosen) return null;
        return candidates.find(info => info.placedHand === chosen.placedHand && info.index === Number(chosen.index) && info.cardId === chosen.cardId) || null;
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

    function resonanceThreshold(attacker, attackHand) {
      return hasAttachment(attacker, attackHand, "resonanceTuning") ? 1 : 0;
    }

    function isResonanceAttack(attacker, attackHand, defender, targetHand) {
      if (!isAlive(attacker, attackHand) || !isAlive(defender, targetHand)) return false;
      return Math.abs(state[attacker][attackHand] - state[defender][targetHand]) <= resonanceThreshold(attacker, attackHand);
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
      if (isTutorialBattle() && attacker === "cpu" && !state.tutorialScriptedCpuAction) {
        console.warn("Blocked unscripted CPU action during tutorial.");
        freezeTutorialBattleToHumanTurn();
        return false;
      }
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
      const willBladeBonus = immutable ? 0 : (hasAttachment(attacker, attackHand, "willBlade") ? (state.lastDirectiveClearCount?.[attacker] || 0) : 0);
      const recklessBonus = immutable ? 0 : (hasAttachment(attacker, attackHand, "recklessBlessing") ? 2 : 0);
      const cursePenalty = hasAttachment(attacker, attackHand, "slowCurse") ? -1 : 0;
      let duelSurgeBonus = 0;
      const lightningBonus=state.temp[attacker].lightningBonus||0;
      const synapseBonus=state.temp[attacker].synapseBonus||0;
      const dimensionalSlashBonus=state.temp[attacker].dimensionalSlashBonus||0;
      const dischargeBonus=hasAttachment(attacker,attackHand,"dischargeBlessing")&&getChargeLevel(attacker)>=10?1:0;
      const danceActive = !!state.temp[attacker]?.dance;
      let resonance = !danceActive && isResonanceAttack(attacker, attackHand, defender, targetHand);
      let resonanceBonus = resonanceAttackBonus(attacker, attackHand, resonance, immutable);
      let power = Math.max(1, basePower + bonus + berserkerBonus + blessingBonus + recklessBonus + willBladeBonus + duelSurgeBonus + lightningBonus + synapseBonus + dimensionalSlashBonus + dischargeBonus + cursePenalty + resonanceBonus);
      state.temp[attacker].attackBonus = 0;
      if (immutable && (positiveCardBonus > 0 || (state.berserkerTurns[attacker] > 0) || hasAttachment(attacker, attackHand, "powerBlessing") || hasAttachment(attacker, attackHand, "recklessBlessing") || (resonance && (state.temp[attacker]?.crescendo || hasAttachment(attacker, attackHand, "largo"))))) {
        addLog(`${handNames[attacker]}の${handNames[attackHand]}は「不変の呪縛」により、攻撃力増加を受けない。`);
      }
      if (blessingBonus) addLog(`${handNames[attacker]}の「力の加護」により、攻撃力+1。`);
      if (recklessBonus) addLog(`${handNames[attacker]}の「捨て身」により、攻撃力+2。`);
      if (willBladeBonus) addLog(`${handNames[attacker]}の「意志の剣」により、攻撃力+${willBladeBonus}。`);
      if (dimensionalSlashBonus) addLog(`${handNames[attacker]}の「空間切断」により、攻撃力+${dimensionalSlashBonus}。`);
      if (resonance && state.temp[attacker]?.crescendo && !immutable) addLog(`${handNames[attacker]}の「クレッシェンド」により、共鳴攻撃の攻撃力+2。`);
      if (resonance && hasAttachment(attacker, attackHand, "largo") && !immutable) addLog(`${handNames[attacker]}の「ラルゴ」により、共鳴攻撃の攻撃力+1。`);
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
      if (state.temp[attacker].breakthrough || state.temp[attacker].electromagneticAttack) {
        addLog(state.temp[attacker].electromagneticAttack
          ? `${handNames[attacker]}の「電磁攻撃」により、相手の罠は発動しない。`
          : `${handNames[attacker]}の「強行突破」により、攻撃中の相手側の罠は発動できない。`);
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
        const redirectedResonance = !danceActive && isResonanceAttack(attacker, attackHand, defender, targetHand);
        const redirectedBonus = resonanceAttackBonus(attacker, attackHand, redirectedResonance, immutable);
        if (redirectedBonus !== resonanceBonus) {
          power = Math.max(1, power + redirectedBonus - resonanceBonus);
          resonanceBonus = redirectedBonus;
        }
        resonance = redirectedResonance;
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

      recordDirectiveAttack(attacker, attackHand, defender, targetHand);
      state.temp[attacker].lightningBonus=0; state.temp[attacker].synapseBonus=0;
      const duelUpdate = updateDuelSurge(attacker, attackHand, defender, targetHand);
      if (duelUpdate.bonus > 0 && !immutable) {
        duelSurgeBonus = duelUpdate.bonus;
        power += duelSurgeBonus;
        context = { defender, targetHand, attacker, attackHand, incomingPower: power };
        addLog(`${handNames[attacker]}の「決闘高潮」Lv.${duelUpdate.level}により、攻撃力+${duelSurgeBonus}。`);
      }

      if (trapResult.cancelAttack) {
        if (state.temp[attacker].lightningZeroAtFive) {
          state.temp[attacker].lightningZeroAtFive = false;
          state.temp[attacker].lightningNoChargeGain = false;
          addLog(`「雷撃」の充電Lv.10効果は、攻撃が無効になったため消費された。`);
        }
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

      if (state.temp[attacker]?.dance) {
        state.temp[attacker].dance = false;
        const before = state[defender][targetHand];
        const matched = state[attacker][attackHand];
        state[defender][targetHand] = matched;
        addLog(`${handNames[attacker]}の「乱舞」により、ダメージは発生せず、${handNames[defender]}の${handNames[targetHand]}を${before}→${matched}に揃えた。`);
        setLastAction(attacker, "乱舞", `${handNames[attackHand]}と${handNames[defender]}の${handNames[targetHand]}の本数を揃えた。`, "card");
        clearBrokenTraps(defender);
        clearBrokenTraps(attacker);
        state.animating = false;
        clearHighlights();
        render();
        return true;
      }

      const before = state[defender][targetHand];
      const total = before + power;
      const overflowWouldApply = total >= 7 && hasAttachment(defender, targetHand, "overflowCurse");
      const guardWouldApply = total >= 5 && !overflowWouldApply && state.temp[defender].guard;
      const lightningZeroActive = !!state.temp[attacker].lightningZeroAtFive;
      let resolvedFinal;

      if (lightningZeroActive && total >= 5) {
        resolvedFinal = 0;
        addLog(`「雷撃」の充電Lv.10効果により、${handNames[defender]}の${handNames[targetHand]}は${total}になった時点で、超過計算をせず0になった。`);
      } else {
        resolvedFinal = overflowWouldApply ? 0 : (guardWouldApply ? 4 : wrapFinger(total));
        if (overflowWouldApply) {
          addLog(`${handNames[defender]}の${handNames[targetHand]}の「超過の呪縛」により、7以上は0になる。`);
        }
      }

      state.temp[attacker].lightningZeroAtFive = false;
      await animateCalculation(defender, targetHand, total, resolvedFinal);

      // ここでいったん攻撃判定を反映する。罠破壊は攻撃判定後罠のあと。
      resolvedFinal = await maybePreventLethalWithEmc2(defender, targetHand, resolvedFinal, "通常攻撃");
      state[defender][targetHand] = resolvedFinal;
      if (guardWouldApply) state.temp[defender].guard = false;
      render();

      // 攻撃判定後：囮、踏み止まりなど。
      if (!trapUsed && !state.temp[attacker].breakthrough && !state.temp[attacker].electromagneticAttack) {
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
        `${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ""}${berserkerBonus ? `+${berserkerBonus}` : ""}${blessingBonus ? `+${blessingBonus}` : ""}${recklessBonus ? `+${recklessBonus}` : ""}${resonanceBonus ? `+${resonanceBonus}` : ""}${cursePenalty ? `${cursePenalty}` : ""}${power !== Math.max(1, basePower + bonus + berserkerBonus + blessingBonus + recklessBonus + resonanceBonus + cursePenalty) ? `→${power}` : ""}で、` +
        `${handNames[defender]}の${handNames[targetHand]}を攻撃。` +
        `${before}→${total}${total >= 5 ? `→${state[defender][targetHand]}` : ""}`
      );

      await resolveResonanceRewards(attacker, attackHand, resonance);
      await resolveAfterAttackBlessings(attacker, attackHand, defender, targetHand, total, trapResult.cancelAttack);

      const damageChargeBlocked = !!state.temp[attacker].lightningNoChargeGain;
      if (!trapResult.cancelAttack && !damageChargeBlocked) {
        if (hasAttachment(attacker, attackHand, "mechanicalGeneration")) {
          gainCharge(attacker, power, "力学発電");
        }
        if (state[defender][targetHand] === 0 && hasAttachment(attacker, attackHand, "bioticE")) {
          gainCharge(attacker, power * 2, "バイオティックE");
        }
      } else if (damageChargeBlocked) {
        addLog(`「雷撃」の効果により、この攻撃では力学発電・バイオティックEなどの充電獲得は発生しない。`);
      }
      state.temp[attacker].lightningNoChargeGain = false;

      clearBrokenTraps(defender);
      clearBrokenTraps(attacker);
      state.temp[attacker].attacksUsed=(state.temp[attacker].attacksUsed||0)+1;
      state.animating = false;
      clearHighlights();
      render();

      const completedAttacks = state.temp[attacker].attacksUsed || 0;
      const currentAttackLimit = state.temp[attacker].attackLimit || 1;

      // 空間切断の1回目は、2回目の入力へ進む前に盤面を明示同期する。
      // 通常の遅延自動同期だけに任せると、相手側では2回分の結果がまとめて反映されてしまう。
      if (
        state.battleMode === "friend" &&
        attacker === "human" &&
        currentAttackLimit > 1 &&
        completedAttacks < currentAttackLimit &&
        !state.gameOver
      ) {
        try {
          // 直前の予約同期と署名が競合しても、途中結果を必ず新しいrevisionで送る。
          state.friendLastPublishedSignature = "";
          await publishFriendStateNow();
          addLog(`「空間切断」：${completedAttacks}回目の攻撃結果をオンライン対戦相手へ同期した。`);
        } catch (error) {
          console.error("PVP dimensional slash intermediate sync failed", error);
          setMessage(`空間切断の途中同期エラー：${error.message || error}`);
        }
      }

      if(completedAttacks>=currentAttackLimit) state.pendingTerminalEnd[attacker]=true;
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
        if (state.battleMode === "friend" && player === "human") {
          emitFriendFx("split", { playerSide: friendSideForLocalPlayer(player), left, right }).catch(error => console.error("PVP split fx failed", error));
        }
        await showPopup(player, "分ける", "左右の本数を分け直しました。", "action", player === "cpu" ? 650 : 500);
      }
      state[player].L = left;
      state[player].R = right;
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

async function endTurn() {
  if (isTutorialBattle()) {
    freezeTutorialBattleToHumanTurn();
    return;
  }
  const endingPlayer=state.turn;
  if(state.temp[endingPlayer]?.lightSpeedCircuit){ setChargeLevel(endingPlayer,0); state.temp[endingPlayer].lightSpeedCircuit=false; addLog(`${handNames[endingPlayer]}の「光速回路」が終了し、充電が0になった。`); }
      if (checkWin()) {
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
      if (checkWin()) {
        render();
        return;
      }

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
        if (state.battleMode === "friend") {
          setMessage("相手の番です。同期を待っています。");
          render();
          await publishFriendStateNow();
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
        elements.battleResultText.textContent = "相手の両手を0にしました。";
      } else if (view === "lose") {
        elements.battleResultTitle.textContent = "敗北…";
        elements.battleResultText.textContent = "あなたの両手が0になりました。";
      } else {
        elements.battleResultTitle.textContent = "引き分け";
        elements.battleResultText.textContent = "同じ効果解決中に両者の両手が0になりました。";
      }
      updateBattleResultPostMatchView(state.friendRoomData?.postMatch);
    }

    function applySyncedBattleResult(result) {
      if (!result) return;
      state.matchResult = result;
      state.gameOver = true;
      const view = localResultView(result);
      setMessage(view === "win" ? "勝利！ 試合が終了しました。" : view === "lose" ? "敗北…。試合が終了しました。" : "引き分け。試合が終了しました。");
      render();
      showBattleResult(result);
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
        await fb.updateDoc(roomRef, {
          "match.version": 50,
          "match.stateRevision": nextRevision,
          "match.state": snapshot,
          "match.result": result,
          "postMatch.matchId": state.friendMatchId,
          "postMatch.hostChoice": null,
          "postMatch.guestChoice": null,
          "postMatch.resolvedAction": null,
          "postMatch.resolutionId": null,
          status: "post-match",
          updatedAt: fb.serverTimestamp()
        });
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
          setMessage(state.battleMode === "friend" ? "勝利！ 相手の両手を0にしました。" : "勝利！ CPUの両手を0にしました。");
          addLog("あなたの勝ち！");
        } else if (view === "lose") {
          setMessage("敗北…。あなたの両手が0になりました。");
          addLog(state.battleMode === "friend" ? "相手の勝ち。" : "CPUの勝ち。");
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
      if (isTutorialBattle()) return false;
      const circuitActive = !!state.temp.cpu.lightSpeedCircuit;
      if (state.temp.cpu.cardActionUsed && !circuitActive) return false;
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
      recordDirectiveAttack(player, attackHand, player, targetHand);
      const before = state[player][targetHand];
      const rawPower = state[player][attackHand];
      const resonance = isResonanceAttack(player, attackHand, player, targetHand);
      const resonanceBonus = resonanceAttackBonus(player, attackHand, resonance);
      const powerBeforeGuard = rawPower + resonanceBonus;
      const power = applyGuardBlessingReduction(player, targetHand, powerBeforeGuard, "凶弾");
      const total = before + power;
      const finalValue = normalize(total, player, targetHand);

      if (resonance && state.temp[player]?.crescendo) {
        addLog(`${handNames[player]}の「クレッシェンド」により、凶弾の共鳴攻撃力+2。`);
      }
      if (resonance && hasAttachment(player, attackHand, "largo")) {
        addLog(`${handNames[player]}の「ラルゴ」により、凶弾の共鳴攻撃力+1。`);
      }

      state.animating = true;
      render();
      await animateAttackIntent(player, attackHand, player, targetHand);
      await animateCalculation(player, targetHand, total, finalValue);

      state[player][targetHand] = finalValue;
      addLog(`${handNames[player]}は「凶弾」で、自分の${handNames[attackHand]}${rawPower}本を使い、${handNames[targetHand]}に${power}本加えた。${before}→${total}${total >= 5 ? `→${finalValue}` : ""}`);
      await resolveResonanceRewards(player, attackHand, resonance);

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
        if (state.battleMode === "friend" && player === "human") {
          emitFriendFx("logicAtelier", {
            playerSide: friendSideForLocalPlayer(player),
            defenderSide: friendSideForLocalPlayer(defender),
            targetHand
          }).catch(error => console.error("PVP logic atelier fx failed", error));
        }
        const before = state[defender][targetHand];
        await showLogicAtelierFx(player, defender, targetHand);
        state[defender][targetHand] = 0;
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

      if (hasBulletproofVest(defender, targetHand)) {
        await triggerBulletproofBlockedFx(defender, "乱射");
        addLog(`${handNames[defender]}の${handNames[targetHand]}にある「防弾チョッキ」が「乱射」を防いだ。`);
        await handleCardDiscardEffect(player, discarded);
        state.pendingTerminalEnd[player] = true;
        state.mode = "attack";
        clearHighlights();
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
      if (isTutorialBattle()) {
        freezeTutorialBattleToHumanTurn();
        return;
      }
      const player = state.turn;
      const attackLimit = state.temp[player]?.attackLimit || 1;
      const attacksUsed = state.temp[player]?.attacksUsed || 0;

      if (
        attackLimit > 1 &&
        attacksUsed > 0 &&
        attacksUsed < attackLimit &&
        !checkWin()
      ) {
        state.selectedAttackHand = null;
        state.mode = "attack";
        elements.splitBox.classList.remove("active");
        elements.andanteBox?.classList.remove("active");
        setMessage(
          `${handNames[player]}は「空間切断」により、もう一度攻撃できます。攻撃に使う手を選んでください。`
        );
        addLog(
          `${handNames[player]}の「空間切断」：` +
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
        state.extraActions[state.turn] -= 1;
        state.selectedAttackHand = null;
        state.mode = "attack";
        elements.splitBox.classList.remove("active");
      elements.andanteBox?.classList.remove("active");
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
      if (state.battleMode === "friend") scheduleFriendStatePublish();
      return true;
    }

    async function onHandClick(event) {
      const card = event.currentTarget;
      const owner = card.dataset.owner;
      const hand = card.dataset.hand;

      if (!tutorialExpectedHand(owner, hand)) return;
      if (tutorial.usingRealBattle && state.battleMode === "tutorial") tutorialAfterHandClick(owner, hand);

      if (state.gameOver || state.animating || state.turn !== "human") return;

      if (state.mode === "dimensionalSlashSacrifice") {
        if (owner !== "human") {
          setMessage("「空間切断」：0にする自分の手を選んでください。");
          return;
        }
        if (state.human[hand] <= 0) {
          setMessage("「空間切断」：すでに0の手は選べません。");
          return;
        }

        const before = state.human[hand];
        const resolved = resolveDimensionalSlash("human", hand);
        if (resolved) {
          addLog(`「空間切断」：${handNames[hand]}を${before}→0にし、効果が発動した。`);
          setMessage(`「空間切断」：${handNames[hand]}を0にしました。攻撃+1、通常攻撃を2回まで行えます。`);
          if (state.battleMode === "friend") scheduleFriendStatePublish();
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
        if (!applyMoveOne("human", hand)) {
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
      state.temp.human = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
      state.temp.cpu = { attackBonus: 0, guard: false, cardActionUsed: false, breakthrough: false, setupMode: false, allegro: false, allegroTriggered: false, crescendo: false, dance: false, lastMelody: false, ominousPower: false, lightningBonus: 0, lightningZeroAtFive: false, lightningNoChargeGain: false, synapseBonus: 0, electromagneticAttack: false, lightSpeedCircuit: false, dimensionalSlashUsed: false, dimensionalSlashBonus: 0, attackLimit: 1, attacksUsed: 0, chargeCardsUsed: [], directiveActions: { attacks: [], splitUsed: false, cardUsed: false } };
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
      state.pendingChargeStun = { human: false, cpu: false };
      state.pendingChargeStunSource = { human: "", cpu: "" };
      state.lightSpeedCircuitUsed = { human: false, cpu: false };
      state.pendingAndanteHand = null;
      state.firstTurnStarted = { human: false, cpu: false };
      state.weaknessWait = {};
      state.highlight = null;
      state.lastAction = null;
      state.turn = "human";
      state.mode = "attack";
      state.selectedAttackHand = null;
      state.animating = false;
      state.gameOver = false;
      state.matchResult = null;
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
      startTurn("human");
      renderDeckBuilder();
    }

    if (elements.battleResultViewBtn) {
      elements.battleResultViewBtn.addEventListener("click", hideBattleResult);
    }
    if (elements.battleResultReopenBtn) {
      elements.battleResultReopenBtn.addEventListener("click", () => {
        if (state.matchResult) showBattleResult(state.matchResult);
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
    elements.plVsCpuBtn.addEventListener("click", () => showScreen("difficulty"));
    elements.plVsPlBtn.addEventListener("click", () => {
      showScreen("friendLobby");
      updateFriendLobbyView();
    });
    elements.battleSelectBackBtn.addEventListener("click", () => showScreen("menu"));
    elements.friendLobbyBackBtn.addEventListener("click", () => showScreen("battleSelect"));
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
    elements.friendStartBattleBtn.addEventListener("click", () => startFriendCommonBattle().catch(error => {
      console.error(error);
      elements.friendLobbyMessage.textContent = `試合開始エラー：${error.message || error}`;
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
    elements.deckBackMenuBtn.addEventListener("click", () => {
      if (state.friendDeckEditReturnToLobby && state.friendRoomId) {
        state.friendDeckEditReturnToLobby = false;
        showScreen("friendLobby");
        updateFriendLobbyView(state.friendRoomData);
        elements.friendLobbyMessage.textContent = "デッキ編集を終了しました。準備完了を押すと新しいデッキを提出します。";
        return;
      }
      showScreen("menu");
    });
    elements.battleBackMenuBtn.addEventListener("click", () => showScreen("menu"));
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
        setMessage("「空間切断」の追加行動では攻撃だけを選べます。");
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
      resetGame();
      setMessage("試合をリセットしました。");
    });

    elements.splitLeft.addEventListener("change", () => syncSplitSelects("left"));
    elements.splitRight.addEventListener("change", () => syncSplitSelects("right"));

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

    elements.clearDeckBtn.addEventListener("click", () => {
      const label = state.editingDeckOwner === "human" ? "あなた用" : "CPU用";
      if (!window.confirm(`${label}デッキを空にしますか？ 保存スロットの内容は消えません。`)) return;
      state.deckCounts[state.editingDeckOwner] = cloneValidDeckCounts({});
      persistCurrentDecks();
      renderDeckBuilder();
      setMessage(`${label}デッキを空にしました。`);
    });


    elements.deckSortSelect?.addEventListener("change", event => {
      state.deckSortMode = event.target.value || "implementation";
      renderDeckBuilder();
    });
    elements.deckNameSearchInput?.addEventListener("input", event => {
      state.deckNameSearch = event.target.value || "";
      renderDeckBuilder();
      elements.deckNameSearchInput?.focus();
    });
    elements.deckKeywordSearchInput?.addEventListener("input", event => {
      state.deckKeywordSearch = event.target.value || "";
      renderDeckBuilder();
      elements.deckKeywordSearchInput?.focus();
    });
    elements.deckSearchClearBtn?.addEventListener("click", () => {
      state.deckNameSearch = "";
      state.deckKeywordSearch = "";
      renderDeckBuilder();
      elements.deckNameSearchInput?.focus();
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
    renderDeckBuilder();
    loadDisplaySettings();
    if (elements.compactCardDescriptionsToggle) {
      elements.compactCardDescriptionsToggle.checked = displaySettings.compactCardDescriptions;
    }
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
