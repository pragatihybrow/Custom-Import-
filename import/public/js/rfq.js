frappe.ui.form.on("Request for Quotation", {
    custom_shipment_address: function (frm) {
        erpnext.utils.get_address_display(frm, "custom_shipment_address", "custom_shipment_address_details", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    custom_currency: function (frm) {
        frappe.call({
            method: "erpnext.setup.utils.get_exchange_rate",
            args: {
                from_currency: frm.doc.custom_currency,
                to_currency: "INR",
                transaction_date: frappe.datetime.get_today()
            },
            callback: function (r) {
                frm.set_value("custom_currency_rate", r.message)
            }
        })
    },
    custom_pickup_request: function (frm) {
        frappe.call({
            method: "import.import.api.get_api_list",
            args: {
                pr: frm.doc.custom_pickup_request
            },
            callback: function (r) {

                var data = r.message[2]
                data.forEach(function (obj) {
                    var row = frm.add_child("custom_purchase_order")
                    row.purchase_order = obj.po_number
                })
                frm.refresh_field("custom_purchase_order")
            }
        })
    },
    before_save: function (frm) {
        if (!frm.doc.custom_previously_data || frm.doc.custom_previously_data.length === 0) {
            let suppliers_list = [];
            frm.doc.suppliers.forEach(row => {
                if (row.supplier) {
                    suppliers_list.push(row.supplier);
                }
            });
            console.log(suppliers_list)
            frm.doc.items.forEach(row => {
                if (row.item_code) {
                    frappe.call({
                        method: "import.config.py.rfq.get_supplier_previously_data",
                        args: {
                            item_code: row.item_code,
                            suppliers: suppliers_list
                        },
                        callback: function (r) {
                            if (r.message) {
                                add_data_in_child_table(frm, row.doctype, row.name, r.message);
                            }
                        }
                    });
                }
            });
        }
    }
})

frappe.ui.form.on("Request for Quotation Item", {
    item_code: function (frm, cdt, cdn) {
        let suppliers_list = [];
        frm.doc.suppliers.forEach(row => {
            if (row.supplier) {
                suppliers_list.push(row.supplier);
            }
        });
        let item = locals[cdt][cdn];
        frappe.call({
            method: "import.config.py.rfq.get_supplier_previously_data",
            args: {
                item_code: item.item_code,
                suppliers: suppliers_list
            },
            callback: function (r) {
                if (r.message) {
                    add_data_in_child_table(frm, cdt, cdn, r.message);
                }
            }
        });
    },
    form_render: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        // Update the HTML display for the current row
        updateChargesHtml(frm, cdt, cdn);
    }
})

function add_data_in_child_table(frm, cdt, cdn, data) {
    var d = locals[cdt][cdn];

    // Loop through the supplier data returned
    for (let supplier in data) {
        if (data.hasOwnProperty(supplier)) {
            let item_data = data[supplier];
            let supplier_exists = false;

            // Check if a row with the same supplier and item_code already exists
            frm.doc.custom_previously_data.forEach(item => {
                if (item.supplier === supplier && item.item_code === d.item_code) {
                    supplier_exists = true;
                    return false;
                }
            });

            if (supplier_exists) continue;

            // Add new row if not already present
            let row = frm.add_child("custom_previously_data");
            row.supplier = supplier;
            row.rate = item_data.rate;
            row.qty = item_data.qty;
            row.received_qty = item_data.received_qty;
            row.item_code = d.item_code;
        }
    }
    frm.refresh_field("custom_previously_data");
}


function updateChargesHtml(frm, cdt, cdn) {
    var d = locals[cdt][cdn];

    // Correct reference to the child table's HTML field
    let row = frm.fields_dict['items'].grid.grid_rows_by_docname[cdn];
    if (!row) return;

    let wrapper = row.grid_form.fields_dict['custom_previously_data'];
    if (!wrapper) return;

    let html = `
        <style>
            .wide-table { width: 100%; }
            .text-right { text-align: right; }
        </style>

        <div class="container mt-3">
            <table class="table table-bordered table-hover wide-table" id="supplier-table">
                <thead class="thead-light">
                    <tr>
                        <th class="text-right">Supplier</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Received Qty</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Dynamic rows will be added here -->
                </tbody>
            </table>
        </div>
    `;

    // Render the initial HTML table
    $(wrapper.wrapper).html(html);

    // Display stored data
    displayStoredData(frm, d.name, d.item_code);

    // Function to display stored data from child table
    function displayStoredData(frm, item_row_name,) {
        frm.doc.custom_previously_data.forEach(function (data_row) {
            if (data_row.item_code === d.item_code) {
                let newRow = `
                    <tr>
                        <td><input type="text" class="form-control supplier-input" name="supplier" value="${data_row.supplier || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right rate-input" name="rate" value="${data_row.rate || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right qty-input" name="qty" value="${data_row.qty || ''}" readonly></td>
                        <td><input type="number" step="0.01" class="form-control text-right received-qty-input" name="received_qty" value="${data_row.received_qty || ''}" readonly></td>
                    </tr>
                `;

                $(wrapper.wrapper).find('#supplier-table tbody').append(newRow);
            }
        });

        frm.refresh_field('items');
    }
}




frappe.ui.form.on('Request for Quotation', {
    refresh: function(frm) {
        // Hide default Supplier Quotation button for Logistics type
        if (frm.doc.custom_type === 'Logistics' && frm.doc.docstatus === 1) {
            // Remove the default "Supplier Quotation" button
            frm.remove_custom_button('Supplier Quotation', 'Create');
            
            // Add custom button for Logistics Supplier Quotation
            frm.add_custom_button(__('Create Logistics Supplier Quotation'), function() {
                create_Logistics_supplier_quotation(frm);
            }, __('Create'));
        }
    }
});

function create_Logistics_supplier_quotation(frm) {
    // Get the first supplier from RFQ suppliers table
    if (!frm.doc.suppliers || frm.doc.suppliers.length === 0) {
        frappe.msgprint(__('Please add at least one supplier to create Supplier Quotation'));
        return;
    }
    
    // Show dialog to select supplier
    let supplier_list = frm.doc.suppliers.map(d => d.supplier);
    
    let d = new frappe.ui.Dialog({
        title: __('Select Supplier'),
        fields: [
            {
                fieldname: 'supplier',
                fieldtype: 'Select',
                label: __('Supplier'),
                options: supplier_list,
                reqd: 1
            }
        ],
        primary_action_label: __('Create'),
        primary_action(values) {
            d.hide();
            create_supplier_quotation(frm, values.supplier);
        }
    });
    
    d.show();
}

function create_supplier_quotation(frm, supplier) {
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Item',
            filters: {
                item_group: 'General services',
                item_name: ['like', '%Transport%']
            },
            fields: ['name', 'stock_uom']
        },
        callback: function(r) {
            let transport_item = null;
            let transport_uom = null;
            
            if (r.message) {
                transport_item = r.message.name;
                transport_uom = r.message.stock_uom;
                create_sq_doc(frm, supplier, transport_item, transport_uom);
            } else {
                // If no transport item found, search more broadly
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Item',
                        filters: {
                            item_group: 'Services'
                        },
                        fields: ['name', 'stock_uom'],
                        limit: 1
                    },
                    callback: function(res) {
                        if (res.message && res.message.length > 0) {
                            transport_item = res.message[0].name;
                            transport_uom = res.message[0].stock_uom;
                            create_sq_doc(frm, supplier, transport_item, transport_uom);
                        } else {
                            frappe.msgprint(__('Please create a Transport Item with Service Item Group first'));
                        }
                    }
                });
                return;
            }
        }
    });
}

function create_sq_doc(frm, supplier, transport_item, transport_uom) {
    frappe.model.with_doctype('Supplier Quotation', function() {
        let sq = frappe.model.get_new_doc('Supplier Quotation');
        
        // Set basic fields
        sq.supplier = supplier;
        sq.transaction_date = frappe.datetime.get_today();
        sq.custom_type = 'Logistics';
        sq.valid_till = frm.doc.schedule_date;

        // Link RFQ & Pickup Request
        sq.custom_request_for_quotation = frm.doc.name;
        sq.custom_pickup_request = frm.doc.custom_pickup_request;

        // ---------------------------------------------------------------------
        // Add transport item (fixed row)
        // ---------------------------------------------------------------------
        if (transport_item) {
            let item_row = frappe.model.add_child(sq, 'items');
            item_row.item_code = transport_item;
            item_row.qty = 1;
            item_row.uom = transport_uom || 'Nos';
            item_row.schedule_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);
            item_row.request_for_quotation = frm.doc.name;
        }

        // ---------------------------------------------------------------------
        // Copy RFQ items to custom_pickup_details and resolve warehouse from PO
        // ---------------------------------------------------------------------
        if (frm.doc.items && frm.doc.items.length > 0) {
            let promises = [];

            frm.doc.items.forEach(function(item) {
                // 1. Get PO number from RFQ item
                let po_no = item.po_number || item.custom_po_no || item.po_no;

                let p = new Promise((resolve) => {

                    if (po_no) {
                        // 2. Fetch warehouse from Purchase Order → set_warehouse
                        frappe.db.get_value("Purchase Order", po_no, "set_warehouse")
                            .then(r => {
                                let warehouse = r.message.set_warehouse;

                                // Create pickup row
                                let pickup_row = frappe.model.add_child(sq, 'custom_pickup_details');
                                pickup_row.pickup_request = frm.doc.custom_pickup_request;
                                pickup_row.item_code = item.item_code;
                                pickup_row.item_name = item.item_name;
                                pickup_row.pick_quantity = item.qty || 0;
                                pickup_row.warehouse = warehouse;

                                resolve();
                            });
                    } else {
                        // If PO not found, fallback without warehouse
                        let pickup_row = frappe.model.add_child(sq, 'custom_pickup_details');
                        pickup_row.pickup_request = frm.doc.custom_pickup_request;
                        pickup_row.item_code = item.item_code;
                        pickup_row.item_name = item.item_name;
                        pickup_row.pick_quantity = item.qty || 0;
                        resolve();
                    }
                });

                promises.push(p);
            });

            // When all PO lookups are complete, open SQ
            Promise.all(promises).then(() => {
                frappe.set_route('Form', 'Supplier Quotation', sq.name);
                frappe.show_alert({
                    message: __('Logistics Supplier Quotation created successfully'),
                    indicator: 'green'
                }, 5);
            });
        } else {
            frappe.set_route('Form', 'Supplier Quotation', sq.name);
        }
    });
}
