import * as React from "react";
import type { GlobalState } from "../globalState";
import { DropUpButton } from "./dropUpButton";
import type { Scene } from "core/scene";
import type { Observer } from "core/Misc/observable";
import type { Nullable } from "core/types";
import type { AnimationGroup } from "core/Animations/animationGroup";
import { AnimationRange } from "core/Animations/animationRange";
import type { Animatable } from "core/Animations/animatable";
import { Skeleton } from "core/Bones/skeleton";

import iconPlay from "../img/icon-play.svg";
import iconPause from "../img/icon-pause.svg";

import "../scss/animationBar.scss";

interface IAnimationBarProps {
    globalState: GlobalState;
    enabled: boolean;
}

export class AnimationBar extends React.Component<IAnimationBarProps, { groupIndex: number }> {
    private _currentScene: Scene;
    private _sliderSyncObserver: Nullable<Observer<Scene>>;
    private _currentGroup: Nullable<AnimationGroup>;
    private _currentSkeleton: Nullable<Skeleton>;
    private _currentRange: Nullable<AnimationRange>;
    private _currentAnimatable: Nullable<Animatable>;
    private _sliderRef: React.RefObject<HTMLInputElement>;
    private _currentPlayingState: boolean;

    public constructor(props: IAnimationBarProps) {
        super(props);

        this._sliderRef = React.createRef();

        this.state = { groupIndex: 0 };

        props.globalState.onSceneLoaded.add((info) => {
            this.registerBeforeRender(info.scene);
        });

        if (this.props.globalState.currentScene) {
            this.registerBeforeRender(this.props.globalState.currentScene);
        }
    }

    getCurrentPosition() {
        if (!this._currentGroup) {
            return "0";
        }
        const targetedAnimations = this._currentGroup.targetedAnimations;
        if (targetedAnimations.length > 0) {
            const runtimeAnimations = this._currentGroup.targetedAnimations[0].animation.runtimeAnimations;
            if (runtimeAnimations.length > 0) {
                return runtimeAnimations[0].currentFrame.toString();
            }
        }

        return "0";
    }

    registerBeforeRender(newScene: Scene) {
        if (this._currentScene) {
            this._currentScene.onBeforeRenderObservable.remove(this._sliderSyncObserver);
        }

        this._currentScene = newScene;
        this._sliderSyncObserver = this._currentScene.onBeforeRenderObservable.add(() => {
            if (this._currentGroup && this._sliderRef.current) {
                this._sliderRef.current.value = this.getCurrentPosition();

                if (this._currentPlayingState !== this._currentGroup.isPlaying) {
                    this.forceUpdate();
                }
            }
        });
    }

    pause() {
        if (!this._currentGroup) {
            return;
        }

        this._currentGroup.pause();
        this.forceUpdate();
    }

    play() {
        if (!this._currentGroup) {
            return;
        }

        this._currentGroup.play();
        this.forceUpdate();
    }

    sliderInput(evt: React.FormEvent<HTMLInputElement>) {
        if (!this._currentGroup) {
            return;
        }

        const value = parseFloat((evt.target as HTMLInputElement).value);

        if (!this._currentGroup.isPlaying) {
            this._currentGroup.play(true);
            this._currentGroup.goToFrame(value);
            this._currentGroup.pause();
        } else {
            this._currentGroup.goToFrame(value);
        }
    }

    getAnimationRange(scene: Scene, index: number) {
        for (let i = 0; i < scene.skeletons.length; i++) {
            const skeleton = scene.skeletons[i];
            const ranges = skeleton.getAnimationRanges();
            if (index < ranges.length) {
                const range = ranges[index];
                return { skeleton, range };
            }
            index -= ranges.length;
        }
        return {};
    }

    public render() {
        if (!this.props.enabled) {
            this._currentGroup = null;
            return null;
        }
        const scene = this.props.globalState.currentScene;

        const groupNames = scene.animationGroups.map((g) => g.name);
        const rangeNames = scene.skeletons.map((s) => s.getAnimationRanges().map((r) => `${s.name} / ${r?.name}`)).flat();

        if (!this._currentGroup || !scene.animationGroups.includes(this._currentGroup)) {
            this._currentGroup = scene.animationGroups[this.state.groupIndex] || null;
            if (this._currentGroup) {
                this._currentGroup.play(true);
                this._currentPlayingState = this._currentGroup.isPlaying;
            }
        }
        if (this.state.groupIndex >= scene.animationGroups.length) {
            const { skeleton, range } = this.getAnimationRange(scene, this.state.groupIndex - scene.animationGroups.length);
            if (this._currentSkeleton !== skeleton || this._currentRange !== range) {
                this._currentGroup?.stop();
                if (skeleton && range) {
                    this._currentSkeleton = skeleton!;
                    this._currentRange = range!;
                    this._currentAnimatable = skeleton?.beginAnimation(range?.name!, true)!;
                    this._currentPlayingState = !!this._currentAnimatable;
                }
            }
        }

        return (
            <div className="animationBar">
                <div className="row">
                    <button id="playBtn">
                        {this._currentGroup?.isPlaying && <img id="pauseImg" src={iconPause} onClick={() => this.pause()} />}
                        {!this._currentGroup?.isPlaying && <img id="playImg" src={iconPlay} onClick={() => this.play()} />}
                    </button>
                    <input
                        ref={this._sliderRef}
                        className="slider"
                        type="range"
                        onInput={(evt) => this.sliderInput(evt)}
                        min={this._currentGroup?.from}
                        max={this._currentGroup?.to}
                        onChange={() => {}}
                        value={this.getCurrentPosition()}
                        step="any"
                    ></input>
                </div>
                <DropUpButton
                    globalState={this.props.globalState}
                    label="Active animation group"
                    options={[...groupNames, ...rangeNames]}
                    activeEntry={() => ""}
                    selectedOption={this._currentGroup?.name || rangeNames?.[0]}
                    onOptionPicked={(option, index) => {
                        this._currentGroup?.stop();
                        this._currentAnimatable?.stop();
                        this._currentGroup = null;
                        this._currentAnimatable = null;

                        this.setState({ groupIndex: index });

                        if (index >= scene.animationGroups.length) {
                            const { skeleton, range } = this.getAnimationRange(scene, index - scene.animationGroups.length);
                            if (skeleton && range) {
                                this._currentSkeleton = skeleton;
                                this._currentRange = range;
                                this._currentAnimatable = skeleton?.beginAnimation(range?.name!, true)!;
                            }
                        } else {
                            this._currentGroup = scene.animationGroups[index].play(true);
                        }
                    }}
                    enabled={true}
                    searchPlaceholder="Search animation"
                />
            </div>
        );
    }
}
