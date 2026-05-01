import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UseItemModal } from './use-item-modal';

describe('UseItemModal', () => {
  let component: UseItemModal;
  let fixture: ComponentFixture<UseItemModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UseItemModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UseItemModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
