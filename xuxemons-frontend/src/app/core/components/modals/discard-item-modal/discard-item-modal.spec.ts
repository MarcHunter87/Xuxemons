import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscardItemModal } from './discard-item-modal';

describe('DiscardItemModal', () => {
  let component: DiscardItemModal;
  let fixture: ComponentFixture<DiscardItemModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscardItemModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiscardItemModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
