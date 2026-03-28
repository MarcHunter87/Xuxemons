import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { XuxemonSize } from '../../interfaces';

@Component({
    selector: 'app-evolution-sequence',
    imports: [],
    templateUrl: './evolution-sequence.html',
    styleUrl: './evolution-sequence.css',
})
export class EvolutionSequence implements OnInit, OnDestroy, AfterViewInit {
    @Input({ required: true }) spriteUrl = '';
    @Input({ required: true }) spriteName = '';
    @Input({ required: true }) fromSize: XuxemonSize = 'Small';
    @Input({ required: true }) toSize: XuxemonSize = 'Medium';
    @Output() finished = new EventEmitter<void>();

    @ViewChild('evolutionAudio') audioEl!: ElementRef<HTMLAudioElement>;

    private finishTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private audioStartTimeoutId: ReturnType<typeof setTimeout> | null = null;

    ngOnInit(): void {
        this.finishTimeoutId = setTimeout(() => this.finish(), 10000);
    }

    ngAfterViewInit(): void {
        if (this.audioEl && this.audioEl.nativeElement) {
            this.audioEl.nativeElement.volume = 0.6;
            this.audioStartTimeoutId = setTimeout(() => {
                this.audioEl.nativeElement.play().catch(e => console.warn('Audio playback prevented by browser policy', e));
                this.audioStartTimeoutId = null;
            }, 50);
        }
    }

    ngOnDestroy(): void {
        if (this.finishTimeoutId) {
            clearTimeout(this.finishTimeoutId);
        }
        if (this.audioStartTimeoutId) {
            clearTimeout(this.audioStartTimeoutId);
            this.audioStartTimeoutId = null;
        }
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        this.finish();
    }

    get fromScale(): number {
        return this.getSizeScale(this.fromSize);
    }

    get toScale(): number {
        return this.getSizeScale(this.toSize);
    }

    private finish(): void {
        if (this.finishTimeoutId) {
            clearTimeout(this.finishTimeoutId);
            this.finishTimeoutId = null;
        }
        this.finished.emit();
    }

    private getSizeScale(size: XuxemonSize): number {
        if (size === 'Large') return 1.28;
        if (size === 'Medium') return 1;
        return 0.72;
    }
}
