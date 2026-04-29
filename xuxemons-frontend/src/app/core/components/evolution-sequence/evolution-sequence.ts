import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
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
    @ViewChild('dialogRoot') dialogRoot?: ElementRef<HTMLElement>;

    private finishTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private audioStartTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private previousFocusedElement: HTMLElement | null = null;

    // Partículas generadas
    readonly particles = [
        { r: 0, d: 1.2 }, { r: 36, d: 0.1 }, { r: 72, d: 1.5 }, { r: 108, d: 0.4 },
        { r: 144, d: 1.8 }, { r: 180, d: 0.7 }, { r: 216, d: 0.2 }, { r: 252, d: 1.1 },
        { r: 288, d: 0.8 }, { r: 324, d: 1.4 }, { r: 15, d: 0.5 }, { r: 50, d: 1.9 },
        { r: 85, d: 0.3 }, { r: 120, d: 1.6 }, { r: 155, d: 0.9 }, { r: 190, d: 1.3 },
        { r: 225, d: 0.6 }, { r: 260, d: 1.7 }, { r: 295, d: 1.0 }, { r: 330, d: 0.4 },
        { r: 25, d: 0.3 }, { r: 65, d: 1.2 }, { r: 95, d: 0.8 }, { r: 135, d: 0.5 },
        { r: 165, d: 1.4 }, { r: 205, d: 0.9 }, { r: 235, d: 0.2 }, { r: 275, d: 1.6 },
        { r: 305, d: 0.7 }, { r: 345, d: 1.1 }, { r: 10, d: 1.5 }, { r: 45, d: 0.4 },
        { r: 80, d: 1.8 }, { r: 115, d: 0.6 }, { r: 150, d: 1.0 }, { r: 185, d: 1.3 },
        { r: 220, d: 0.5 }, { r: 255, d: 1.7 }, { r: 290, d: 0.9 }, { r: 325, d: 0.2 }
    ];
    // Sirve para inicializar el componente
    ngOnInit(): void {
        this.previousFocusedElement = typeof document !== 'undefined'
            ? (document.activeElement as HTMLElement | null)
            : null;
        this.finishTimeoutId = setTimeout(() => this.finish(), 10000);
    }

    // Sirve para inicializar el componente después de la vista
    ngAfterViewInit(): void {
        if (this.dialogRoot?.nativeElement) {
            setTimeout(() => this.dialogRoot?.nativeElement.focus(), 0);
        }

        if (this.audioEl && this.audioEl.nativeElement) {
            this.audioEl.nativeElement.volume = 0.6;
            this.audioStartTimeoutId = setTimeout(() => {
                this.audioEl.nativeElement.play().catch(e => console.warn('Audio playback prevented by browser policy', e));
                this.audioStartTimeoutId = null;
            }, 50);
        }
    }

    // Sirve para destruir el componente
    ngOnDestroy(): void {
        if (this.finishTimeoutId) {
            clearTimeout(this.finishTimeoutId);
        }
        if (this.audioStartTimeoutId) {
            clearTimeout(this.audioStartTimeoutId);
            this.audioStartTimeoutId = null;
        }
        if (this.audioEl?.nativeElement) {
            this.audioEl.nativeElement.pause();
            this.audioEl.nativeElement.currentTime = 0;
        }
    }

    // Sirve para manejar la tecla Escape
    @HostListener('document:keydown.escape')
    onEscape(): void {
        this.finish();
    }

    // Sirve para manejar la tecla Tab
    onModalKeydown(event: KeyboardEvent): void {
        if (event.key === 'Tab') {
            event.preventDefault();
            this.dialogRoot?.nativeElement.focus();
        }
    }

    // Sirve para obtener el factor de escala del tamaño de origen
    get fromScale(): number {
        return this.getSizeScale(this.fromSize);
    }

    // Sirve para obtener el factor de escala del tamaño de destino
    get toScale(): number {
        return this.getSizeScale(this.toSize);
    }

    // Sirve para finalizar la secuencia
    private finish(): void {
        if (this.finishTimeoutId) {
            clearTimeout(this.finishTimeoutId);
            this.finishTimeoutId = null;
        }
        if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
            setTimeout(() => this.previousFocusedElement?.focus(), 0);
        }
        this.finished.emit();
    }

    // Sirve para obtener el factor de escala del tamaño
    private getSizeScale(size: XuxemonSize): number {
        if (size === 'Large') return 1.28;
        if (size === 'Medium') return 1;
        return 0.72;
    }
}
