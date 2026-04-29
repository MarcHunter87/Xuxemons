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
    readonly particles = this.buildParticles(40);
    
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

    // Sirve para generar la distribución radial de partículas
    private buildParticles(total: number): Array<{ r: number; d: number }> {
        return Array.from({ length: total }, (_, index) => {
            const baseAngle = (index * 360) / total;
            const jitter = ((index * 37) % 11) - 5;
            const delay = (((index * 73) % 19) + 1) / 10;

            return {
                r: Math.round(baseAngle + jitter),
                d: Number(delay.toFixed(1)),
            };
        });
    }
}
