import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { XuxemonSize } from '../../interfaces';

@Component({
    selector: 'app-evolution-sequence',
    imports: [],
    templateUrl: './evolution-sequence.html',
    styleUrl: './evolution-sequence.css',
})
export class EvolutionSequence implements OnInit, OnDestroy {
    @Input({ required: true }) spriteUrl = '';
    @Input({ required: true }) spriteName = '';
    @Input({ required: true }) fromSize: XuxemonSize = 'Small';
    @Input({ required: true }) toSize: XuxemonSize = 'Medium';
    @Input() videoSrc = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';
    @Output() finished = new EventEmitter<void>();

    private finishTimeoutId: ReturnType<typeof setTimeout> | null = null;

    ngOnInit(): void {
        this.finishTimeoutId = setTimeout(() => this.finish(), 9800);
    }

    ngOnDestroy(): void {
        if (this.finishTimeoutId) {
            clearTimeout(this.finishTimeoutId);
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
