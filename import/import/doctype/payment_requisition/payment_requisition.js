frappe.ui.form.on('Payment Requisition', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 0 && !frm.doc.pickup_request) {
            frm.add_custom_button(__('Get Pickup Request'), function() {
                show_pickup_request_dialog(frm);
            }).addClass('btn-primary');
        }
        if (
            frm.doc.workflow_state == "Create Bill Of Entry" &&
            frm.doc.docstatus == 0 &&
            frm.doc.bill_of_entry_created !== 1
        ) {
            frm.add_custom_button(__('Bill Of Entry'), () => {
                frappe.call({
                    method: "import.import.doctype.boe.boe.create_boe",
                    args: {
                        payment_requisition: frm.doc.name
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route('Form', 'BOE', r.message);
                        }
                    }
                });
            }, __('Create'));
        }
        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: {
                    amount: frm.doc.duty_amount
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }
    },

    pickup_request: function(frm) {
        // When pickup request is manually changed, fetch details
        if (frm.doc.pickup_request) {
            fetch_pickup_request_details(frm, frm.doc.pickup_request);
        }
    },
    
    duty_amount: function(frm) {
        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: {
                    amount: frm.doc.duty_amount
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }
    },

    onload: function(frm) {
        if (!frm.doc.posting_date) {
            frm.set_value("posting_date", frappe.datetime.get_today());
        }
    }
});

function show_pickup_request_dialog(frm) {
    // Create dialog to show available pickup requests
    let d = new frappe.ui.Dialog({
        title: __('Select Pickup Request'),
        fields: [
            {
                fieldname: 'search_filter',
                fieldtype: 'Data',
                label: __('Search'),
                placeholder: __('Type to search...'),
                onchange: function() {
                    window.current_page = 1;
                    filter_and_render_table(this.value);
                }
            },
            {
                fieldname: 'pickup_request_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'pagination_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'selected_pickup_request',
                fieldtype: 'Data',
                hidden: 1
            }
        ],
        size: 'extra-large',
        primary_action_label: __('Fetch Details'),
        primary_action: function() {
            let selected = d.get_value('selected_pickup_request');
            if (selected) {
                fetch_pickup_request_details(frm, selected);
                d.hide();
            } else {
                frappe.msgprint(__('Please select a Pickup Request'));
            }
        }
    });

    // Fetch available pickup requests
    frappe.call({
        method: 'import.import.doctype.payment_requisition.payment_requisition.get_available_pickup_requests',
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                window.all_pickup_data = r.message;
                window.current_page = 1;
                window.items_per_page = 5;
                window.current_dialog = d;
                render_pickup_requests(d, r.message);
            } else {
                d.fields_dict.pickup_request_html.$wrapper.html(
                    '<div class="text-center text-muted" style="padding: 50px;">' +
                    '<i class="fa fa-inbox fa-3x"></i><br><br>' +
                    '<h4>No Pickup Requests Available</h4>' +
                    '<p>All pickup requests have been processed or none are submitted yet.</p>' +
                    '</div>'
                );
            }
        }
    });

    d.show();
}

function filter_and_render_table(search_text) {
    search_text = (search_text || '').toLowerCase();
    
    if (!search_text) {
        window.filtered_data = window.all_pickup_data;
    } else {
        window.filtered_data = window.all_pickup_data.filter(row => {
            let searchable = (row.name + ' ' + (row.company || '') + ' ' + (row.incoterm || '')).toLowerCase();
            return searchable.includes(search_text);
        });
    }
    
    render_pickup_requests(window.current_dialog, window.filtered_data);
}

function render_pickup_requests(dialog, data) {
    window.filtered_data = data;
    
    let total_items = data.length;
    let total_pages = Math.ceil(total_items / window.items_per_page);
    let start_index = (window.current_page - 1) * window.items_per_page;
    let end_index = Math.min(start_index + window.items_per_page, total_items);
    let paginated_data = data.slice(start_index, end_index);

    let html = `
        <style>
            .pickup-request-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                font-size: 13px;
            }
            .pickup-request-table th {
                background-color: #f8f9fa;
                padding: 12px 8px;
                text-align: left;
                border: 1px solid #dee2e6;
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            .pickup-request-table td {
                padding: 10px 8px;
                border: 1px solid #dee2e6;
            }
            .pickup-request-table tbody tr:hover {
                background-color: #f1f3f5;
                cursor: pointer;
            }
            .pickup-request-table tr.selected {
                background-color: #e7f5ff;
            }
            .table-wrapper {
                max-height: 400px;
                overflow-y: auto;
            }
            .pr-link {
                color: #2490ef;
                font-weight: 500;
            }
        </style>
        <div class="table-wrapper">
            <table class="pickup-request-table" id="pr-table">
                <thead>
                    <tr>
                        <th width="50">Select</th>
                        <th>Pickup Request</th>
                        <th>PO Date</th>
                        <th>Company</th>
                        <th>Incoterm</th>
                        <th>Mode of Shipment</th>
                        <th>Origin</th>
                        <th class="text-right">Grand Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (paginated_data.length === 0) {
        html += `
            <tr>
                <td colspan="8" class="text-center text-muted" style="padding: 30px;">
                    No results found
                </td>
            </tr>
        `;
    } else {
        paginated_data.forEach(row => {
            html += `
                <tr data-name="${row.name}">
                    <td class="text-center">
                        <input type="radio" name="pickup_request_radio" value="${row.name}">
                    </td>
                    <td><span class="pr-link">${row.name}</span></td>
                    <td>${frappe.datetime.str_to_user(row.po_date) || '-'}</td>
                    <td>${row.company || '-'}</td>
                    <td>${row.incoterm || '-'}</td>
                    <td>${row.mode_of_shipment || '-'}</td>
                    <td>${row.country_origin || '-'}</td>
                    <td class="text-right">${format_currency(row.grand_total || 0, row.currency)}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table></div>`;
    dialog.fields_dict.pickup_request_html.$wrapper.html(html);

    // Render pagination
    render_pagination(dialog, total_items, total_pages);

    // Add click handlers
    dialog.$wrapper.find('.pickup-request-table tbody tr').on('click', function() {
        let name = $(this).data('name');
        if (name) {
            $(this).find('input[type="radio"]').prop('checked', true);
            $(this).addClass('selected').siblings().removeClass('selected');
            dialog.set_value('selected_pickup_request', name);
        }
    });
}

function render_pagination(dialog, total_items, total_pages) {
    if (total_items === 0) {
        dialog.fields_dict.pagination_html.$wrapper.html('');
        return;
    }

    let start_item = (window.current_page - 1) * window.items_per_page + 1;
    let end_item = Math.min(window.current_page * window.items_per_page, total_items);

    let pagination_html = `
        <style>
            .pagination-wrapper {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 0;
                margin-top: 10px;
                border-top: 1px solid #dee2e6;
            }
            .pagination-info {
                color: #6c757d;
                font-size: 13px;
            }
            .pagination-controls {
                display: flex;
                gap: 5px;
            }
            .pagination-btn {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                background: white;
                cursor: pointer;
                border-radius: 4px;
                font-size: 13px;
                transition: all 0.2s;
            }
            .pagination-btn:hover:not(:disabled) {
                background: #f8f9fa;
                border-color: #adb5bd;
            }
            .pagination-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .pagination-btn.active {
                background: #2490ef;
                color: white;
                border-color: #2490ef;
            }
        </style>
        <div class="pagination-wrapper">
            <div class="pagination-info">
                Showing ${start_item} to ${end_item} of ${total_items} entries
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" id="first-page" ${window.current_page === 1 ? 'disabled' : ''}>
                    <i class="fa fa-angle-double-left"></i>
                </button>
                <button class="pagination-btn" id="prev-page" ${window.current_page === 1 ? 'disabled' : ''}>
                    <i class="fa fa-angle-left"></i>
                </button>
    `;

    // Page numbers
    let start_page = Math.max(1, window.current_page - 2);
    let end_page = Math.min(total_pages, window.current_page + 2);

    for (let i = start_page; i <= end_page; i++) {
        pagination_html += `
            <button class="pagination-btn page-number ${i === window.current_page ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    pagination_html += `
                <button class="pagination-btn" id="next-page" ${window.current_page === total_pages ? 'disabled' : ''}>
                    <i class="fa fa-angle-right"></i>
                </button>
                <button class="pagination-btn" id="last-page" ${window.current_page === total_pages ? 'disabled' : ''}>
                    <i class="fa fa-angle-double-right"></i>
                </button>
            </div>
        </div>
    `;

    dialog.fields_dict.pagination_html.$wrapper.html(pagination_html);

    // Add event listeners
    dialog.$wrapper.find('#first-page').on('click', function() {
        if (window.current_page !== 1) {
            window.current_page = 1;
            render_pickup_requests(dialog, window.filtered_data);
        }
    });

    dialog.$wrapper.find('#prev-page').on('click', function() {
        if (window.current_page > 1) {
            window.current_page--;
            render_pickup_requests(dialog, window.filtered_data);
        }
    });

    dialog.$wrapper.find('#next-page').on('click', function() {
        if (window.current_page < total_pages) {
            window.current_page++;
            render_pickup_requests(dialog, window.filtered_data);
        }
    });

    dialog.$wrapper.find('#last-page').on('click', function() {
        if (window.current_page !== total_pages) {
            window.current_page = total_pages;
            render_pickup_requests(dialog, window.filtered_data);
        }
    });

    dialog.$wrapper.find('.page-number').on('click', function() {
        let page = parseInt($(this).data('page'));
        if (page !== window.current_page) {
            window.current_page = page;
            render_pickup_requests(dialog, window.filtered_data);
        }
    });
}


function fetch_pickup_request_details(frm, pickup_request_name) {
    frappe.call({
        method: 'import.import.doctype.payment_requisition.payment_requisition.get_pickup_request_details',
        args: { pickup_request: pickup_request_name },
        freeze: true,
        freeze_message: __('Fetching Pickup Request details...'),
        callback: function(r) {
            if (r.message) {
                let pr = r.message;

                frm.set_value('pickup_request', pr.name);
                frm.set_value('mode_of_shipment', pr.mode_of_shipment);
                frm.set_value('origin', pr.country_origin);
                frm.set_value('posting_date', frappe.datetime.get_today());
                frm.set_value('company', pr.company);

                // Clear and add POs
                frm.clear_table('po_wono');
                if (pr.po_list && pr.po_list.length > 0) {
                    pr.po_list.forEach(function(po) {
                        let row = frm.add_child('po_wono');
                        row.purchase_order = po.purchase_order;
                    });
                }
                frm.refresh_field('po_wono');

                // Clear and add Suppliers
                frm.clear_table('supplier_name');
                if (pr.supplier_name) {
                    let suppliers = pr.supplier_name.split(',').map(s => s.trim());
                    suppliers.forEach(function(supplier) {
                        if (supplier) {
                            let row = frm.add_child('supplier_name');
                            row.supplier = supplier;
                        }
                    });
                }
                frm.refresh_field('supplier_name');

                // Clear and add Items
                frm.clear_table('items');
                if (pr.items && pr.items.length > 0) {
                    pr.items.forEach(function(item) {
                        let row = frm.add_child('items');
                        row.item = item.item;
                        row.description = item.description;
                        // Add any other fields you want to map
                    });
                }
                frm.refresh_field('items');

                if (pr.po_date) frm.set_value('po_wo_date', pr.po_date);

                frappe.show_alert({
                    message: __('Pickup Request details fetched successfully'),
                    indicator: 'green'
                }, 5);

                frm.refresh();
            }
        }
    });
}

// function fetch_pickup_request_details(frm, pickup_request_name) {
//     frappe.call({
//         method: 'import.import.doctype.payment_requisition.payment_requisition.get_pickup_request_details',
//         args: { pickup_request: pickup_request_name },
//         freeze: true,
//         freeze_message: __('Fetching Pickup Request details...'),
//         callback: function(r) {
//             if (r.message) {
//                 let pr = r.message;

//                 frm.set_value('pickup_request', pr.name);
//                 frm.set_value('mode_of_shipment', pr.mode_of_shipment);
//                 frm.set_value('origin', pr.country_origin);
//                 frm.set_value('posting_date', frappe.datetime.get_today());
//                 frm.set_value('company', pr.company);

//                 // Clear and add POs
//                 frm.clear_table('po_wono');
//                 if (pr.po_list && pr.po_list.length > 0) {
//                     pr.po_list.forEach(function(po) {
//                         let row = frm.add_child('po_wono');
//                         row.purchase_order = po.purchase_order;
//                     });
//                 }
//                 frm.refresh_field('po_wono');

//                 // CORRECTED: Handle supplier_name based on field type
//                 // If supplier_name is Table MultiSelect field
//                 frm.clear_table('supplier_name');
//                 if (pr.supplier_name) {
//                     let suppliers = pr.supplier_name.split(',').map(s => s.trim());
//                     suppliers.forEach(function(supplier) {
//                         if (supplier) {
//                             let row = frm.add_child('supplier_name');
//                             row.supplier = supplier;
//                         }
//                     });
//                 }
//                 frm.refresh_field('supplier_name');

//                 if (pr.po_date) frm.set_value('po_wo_date', pr.po_date);

//                 frappe.show_alert({
//                     message: __('Pickup Request details fetched successfully'),
//                     indicator: 'green'
//                 }, 5);

//                 frm.refresh();
//             }
//         }
//     });
// }